export function appendAnswer(
    previous: string,
    event: { answer_delta: string; answer_offset: number; answer_reset: boolean },
) {
    const base = event.answer_reset ? "" : previous;
    // Server offsets count Unicode code points, including non-BMP characters.
    if (Array.from(base).length !== event.answer_offset)
        throw new Error("Assistant stream offset mismatch");
    return base + event.answer_delta;
}
