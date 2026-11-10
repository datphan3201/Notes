import test from "node:test";
import assert from "node:assert/strict";
import {
    parseBlocks,
    tokenizeInline,
    normalizeKind,
} from "../src/lib/assistant-message.ts";

test("assistant markdown blocks parse paragraphs, ordered lists and nested bullet items", () => {
    const raw = `Tôi đã tạo lịch trình (roadmap) học IELTS toàn diện thuộc khu vực **University** [area:a83180b4-79ef-4ae3-bfe7-2038bf7f5472] với cấu trúc gồm 4 giai đoạn cụ thể:

1. **Giai đoạn 1: Xây dựng nền tảng (Foundation)** [milestone:c2]
   - Ôn tập các chủ điểm ngữ pháp cốt lõi [task:c3]
   - Xây dựng từ vựng học thuật cơ bản [task:c4]
   - Luyện phát âm IPA và trọng âm [task:c5]
2. **Giai đoạn 2: Phát triển kỹ năng Listening & Reading** [milestone:c6]
   - Luyện các dạng câu hỏi Listening (Multiple Choice, Map/Plan...) [task:c7]
   - Luyện các dạng câu hỏi Reading (Matching Headings, T/F/NG...) [task:c8]
   - Phân tích từ đồng nghĩa & paraphrase [task:c9]
3. **Giai đoạn 3: Phát triển kỹ năng Writing & Speaking** [milestone:c10]
   - Luyện viết Writing Task 1 [task:c11] và Task 2 [task:c12]
   - Luyện Speaking Part 1, 2, 3 theo chủ đề [task:c13]
4. **Giai đoạn 4: Luyện đề và chuẩn bị thi (Exam Practice)** [milestone:c14]
   - Làm Full Test dưới áp lực thời gian [task:c15]
   - Phân tích lỗi sai và tổng hợp từ vựng ăn điểm [task:c16]
   - Ôn tập tổng lực và chuẩn bị tâm lý thi [task:c17]

Xác nhận đề xuất bên dưới để áp dụng.`;

    const blocks = parseBlocks(raw);
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0].type, "p");
    assert.equal(blocks[1].type, "ol");
    assert.equal(blocks[2].type, "p");

    if (blocks[1].type === "ol") {
        assert.equal(blocks[1].items.length, 4);
        assert.equal(blocks[1].items[0].subItems.length, 3);
        assert.equal(blocks[1].items[1].subItems.length, 3);
        assert.equal(blocks[1].items[2].subItems.length, 2);
        assert.equal(blocks[1].items[3].subItems.length, 3);
    }
});

test("assistant inline tokenizer extracts bold, code and entity tags", () => {
    const text =
        "Khu vực **University** [area:a83180b4-79ef-4ae3-bfe7-2038bf7f5472] và `test_code`";
    const tokens = tokenizeInline(text);

    assert.deepEqual(tokens, [
        { type: "text", value: "Khu vực " },
        { type: "bold", value: "University" },
        { type: "text", value: " " },
        {
            type: "entity",
            kind: "area",
            id: "a83180b4-79ef-4ae3-bfe7-2038bf7f5472",
        },
        { type: "text", value: " và " },
        { type: "code", value: "test_code" },
    ]);
});

test("assistant normalizeKind maps singular and plural kinds correctly", () => {
    assert.equal(normalizeKind("area"), "areas");
    assert.equal(normalizeKind("milestone"), "milestones");
    assert.equal(normalizeKind("task"), "tasks");
    assert.equal(normalizeKind("goal"), "goals");
    assert.equal(normalizeKind("tasks"), "tasks");
    assert.equal(normalizeKind("milestones"), "milestones");
});
