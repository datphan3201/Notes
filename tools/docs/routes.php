<?php

declare(strict_types=1);

namespace Planner\Documentation;

/**
 * Inspect route declarations without booting the application, opening a database,
 * reading environment secrets or invoking a controller. Uninitialized controller
 * objects are used only to bind their public methods into the route closures.
 *
 * @return list<array{methods:list<string>,path:string,name:string,auth:bool,csrf:bool,rate_limit:?string,handler:string,handler_path:string,handler_line:int}>
 */
function routes(): array
{
    $root = dirname(__DIR__, 2);
    require_once $root.'/backend/vendor/autoload.php';
    $factory = require $root.'/backend/routes/web.php';
    $arguments = [];
    foreach ((new \ReflectionFunction($factory))->getParameters() as $parameter) {
        $type = $parameter->getType();
        if (!$type instanceof \ReflectionNamedType || $type->isBuiltin()) {
            throw new \RuntimeException('Route factory parameter needs an explicit controller class.');
        }
        $arguments[] = (new \ReflectionClass($type->getName()))->newInstanceWithoutConstructor();
    }
    $result = [];
    foreach ($factory(...$arguments) as $route) {
        $reflection = new \ReflectionFunction($route->handler);
        $owner = $reflection->getClosureThis();
        $handler = $owner === null ? 'route closure' : $owner::class.'::'.$reflection->getName();
        $handlerReflection = $reflection;
        if ($owner === null) {
            foreach ($reflection->getStaticVariables() as $variableName => $variable) {
                if (is_object($variable) && str_starts_with($variable::class, 'Planner\\Http\\Controller\\')) {
                    $handler = $variable::class.' (route wrapper)';
                    $declaration = implode('', array_slice(file($reflection->getFileName()), $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1));
                    if (preg_match('/\$'.preg_quote($variableName, '/').'->([A-Za-z_][A-Za-z0-9_]*)\s*\(/', $declaration, $call)) {
                        $handler = $variable::class.'::'.$call[1];
                        $handlerReflection = new \ReflectionMethod($variable, $call[1]);
                    }
                    break;
                }
            }
        }
        $result[] = [
            'methods' => $route->methods,
            'path' => $route->path,
            'name' => $route->name,
            'auth' => $route->auth,
            'csrf' => $route->csrf,
            'rate_limit' => $route->rateLimit,
            'handler' => $handler,
            'handler_path' => substr($handlerReflection->getFileName(), strlen($root) + 1),
            'handler_line' => $handlerReflection->getStartLine(),
        ];
    }

    return $result;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    echo json_encode(routes(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL;
}
