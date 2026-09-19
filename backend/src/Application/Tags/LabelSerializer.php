<?php

declare(strict_types=1);

namespace Planner\Application\Tags;

use Planner\Domain\Tags\TagRecord;

final class LabelSerializer
{
    /** @return array{id:string,name:string,version:int,parent_id:?string,color:string,position:int} */
    public function one(TagRecord $label): array
    {
        return [
            'id' => (string) $label->id,
            'name' => $label->name,
            'version' => $label->version,
            'parent_id' => $label->parentId === null ? null : (string) $label->parentId,
            'color' => $label->color,
            'position' => $label->position,
        ];
    }
}
