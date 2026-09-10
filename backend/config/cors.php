<?php

return [
    // R1 is same-origin. Keeping this list empty avoids advertising a public
    // cross-origin API while the session cookie remains browser-only.
    'paths' => [],
    'allowed_methods' => [],
    'allowed_origins' => [],
    'allowed_origins_patterns' => [],
    'allowed_headers' => [],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
