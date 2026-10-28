<?php foreach ([1 => '1 · Low', 2 => '2 · Minor', 3 => '3 · Normal', 4 => '4 · High', 5 => '5 · Important'] as $importanceValue => $importanceLabel): ?>
<option value="<?= $importanceValue ?>"<?= $importanceValue === 3 ? ' selected' : '' ?>><?= $view->e($view->t($importanceLabel)) ?></option>
<?php endforeach; ?>
