<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class NotesPageController extends Controller
{
    public function index(Request $request): View
    {
        $request->user()->loadMissing('preferences');

        return view('notes.index', [
            'user' => $request->user(),
            'preferences' => $request->user()->preferences,
        ]);
    }
}
