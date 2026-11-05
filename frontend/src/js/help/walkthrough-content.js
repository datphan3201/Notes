// The short tour behind the ? button, in English and Vietnamese. Each step shows a real
// screenshot (`shot`, from backend/public/guide/<language>/<shot>.webp, made by tools/guide);
// the full guide with every use case is the /help page.
export const walkthroughSteps = [
    {
        id: 'welcome',
        shot: 'dashboard',
        group: { en: 'Getting started', vi: 'Bắt đầu' },
        title: { en: 'Welcome to Planner', vi: 'Chào mừng bạn đến với Planner' },
        intro: {
            en: 'Planner turns your goals into small steps you can take today, and keeps your habits, notes and look-backs in the same place.',
            vi: 'Planner biến mục tiêu thành những bước nhỏ làm được hôm nay, và giữ thói quen, ghi chú, những lần nhìn lại ở cùng một nơi.',
        },
        instructions: [
            {
                en: 'The sidebar opens Dashboard, Goals, Tasks, Calendar, Habits, Notes, Reviews and Teamwork. On a phone, open the menu button first.',
                vi: 'Thanh bên mở Tổng quan, Mục tiêu, Công việc, Lịch, Thói quen, Ghi chú, Đánh giá và Làm việc nhóm. Trên điện thoại, mở nút menu trước.',
            },
            {
                en: 'The bell shows invitations and reminders, ? reopens this tour, and the sparkle button at the bottom right opens the AI assistant.',
                vi: 'Chuông hiện lời mời và nhắc hẹn, nút ? mở lại vòng giới thiệu này, nút lấp lánh ở góc dưới bên phải mở trợ lý AI.',
            },
        ],
        imageAlt: {
            en: 'The Dashboard with the goal roadmap, today’s tasks and habits',
            vi: 'Trang Tổng quan với lộ trình mục tiêu, việc hôm nay và thói quen',
        },
    },
    {
        id: 'structure',
        shot: 'roadmap',
        group: { en: 'Getting started', vi: 'Bắt đầu' },
        title: { en: 'How your plans fit together', vi: 'Kế hoạch được sắp xếp thế nào' },
        intro: {
            en: 'Area → Goal → Milestone → Task. A goal is an outcome, milestones are its stages and tasks are the concrete steps.',
            vi: 'Lĩnh vực → Mục tiêu → Cột mốc → Công việc. Mục tiêu là kết quả muốn đạt, cột mốc là các chặng, công việc là từng bước cụ thể.',
        },
        instructions: [
            {
                en: 'Each task lives in one place: a milestone, a goal or the Inbox. Habits and notes stand on their own and can be linked to a goal.',
                vi: 'Mỗi công việc chỉ nằm ở một nơi: một cột mốc, một mục tiêu hoặc Hộp thư đến. Thói quen và ghi chú độc lập và có thể gắn với một mục tiêu.',
            },
            {
                en: 'Progress is calculated for you, but you decide when a goal or milestone is complete.',
                vi: 'Tiến độ được tính sẵn, nhưng bạn là người quyết định khi nào mục tiêu hay cột mốc hoàn thành.',
            },
        ],
        imageAlt: {
            en: 'A goal roadmap with four milestones',
            vi: 'Lộ trình của một mục tiêu với bốn cột mốc',
        },
    },
    {
        id: 'dashboard',
        shot: 'dashboard-week',
        group: { en: 'Every day', vi: 'Mỗi ngày' },
        title: { en: 'Plan your day and week', vi: 'Lên kế hoạch ngày và tuần' },
        intro: {
            en: 'The Dashboard shows today’s work, your habits and the plan for the week.',
            vi: 'Tổng quan cho biết việc hôm nay, thói quen và kế hoạch của tuần.',
        },
        instructions: [
            {
                en: 'Daily: Add task picks today’s work; click the circle in front of a task to complete it.',
                vi: 'Hằng ngày: Thêm công việc để chọn việc hôm nay; bấm vòng tròn trước tên việc để hoàn thành.',
            },
            {
                en: 'Weekly lists the tasks picked for this week; + brings one into today. Activity shows your year at a glance.',
                vi: 'Hằng tuần liệt kê việc đã chọn cho tuần; dấu + đưa một việc vào hôm nay. Hoạt động cho thấy cả năm của bạn.',
            },
        ],
        imageAlt: {
            en: 'The Weekly tab of the Dashboard',
            vi: 'Thẻ Hằng tuần của trang Tổng quan',
        },
    },
    {
        id: 'tasks',
        shot: 'tasks',
        group: { en: 'Every day', vi: 'Mỗi ngày' },
        title: { en: 'Capture and find tasks', vi: 'Ghi lại và tìm công việc' },
        intro: {
            en: 'New task captures anything in seconds: name first, details later.',
            vi: 'Công việc mới ghi lại mọi việc trong vài giây: tên trước, chi tiết sau.',
        },
        instructions: [
            {
                en: 'Today, Next, This week, Backlog, Overdue and All show the same tasks by time; Repeating holds your repeating series.',
                vi: 'Hôm nay, Sắp tới, Tuần này, Chưa lên lịch, Quá hạn và Tất cả xem công việc theo thời gian; Lặp lại chứa các chuỗi lặp.',
            },
            {
                en: 'Click a task’s name to edit it on the side; the ⋯ menu sets a due date, reminder or repeat.',
                vi: 'Bấm tên việc để sửa ngay bên cạnh; menu ⋯ đặt hạn, nhắc hẹn hoặc lặp lại.',
            },
        ],
        imageAlt: {
            en: 'The Tasks page grouped by goal',
            vi: 'Trang Công việc nhóm theo mục tiêu',
        },
    },
    {
        id: 'calendar',
        shot: 'calendar',
        group: { en: 'Every day', vi: 'Mỗi ngày' },
        title: { en: 'Move work on the Calendar', vi: 'Dời việc trên Lịch' },
        intro: {
            en: 'The Calendar shows the dates of your tasks, milestones and goals by month or week.',
            vi: 'Lịch hiện ngày của công việc, cột mốc và mục tiêu theo tháng hoặc tuần.',
        },
        instructions: [
            {
                en: 'Drag an item to another day, or use Move to another day on a phone. A work slot keeps its times.',
                vi: 'Kéo một mục sang ngày khác, hoặc dùng Dời sang ngày khác trên điện thoại. Khung giờ làm việc giữ nguyên giờ.',
            },
            {
                en: 'Unscheduled lists tasks without a date: drag one onto a day to give it a due date.',
                vi: 'Chưa có lịch liệt kê việc chưa có ngày: kéo vào một ngày để đặt hạn.',
            },
        ],
        imageAlt: { en: 'The month calendar', vi: 'Lịch theo tháng' },
    },
    {
        id: 'habits',
        shot: 'habits',
        group: { en: 'Every day', vi: 'Mỗi ngày' },
        title: { en: 'Keep your habits', vi: 'Giữ thói quen' },
        intro: {
            en: 'Tick a habit each day to grow your streak.',
            vi: 'Đánh dấu thói quen mỗi ngày để kéo dài chuỗi ngày.',
        },
        instructions: [
            {
                en: 'A habit is daily or 1–7 days a week. Click a day on its strip to check in a past day.',
                vi: 'Thói quen có thể hằng ngày hoặc 1–7 ngày mỗi tuần. Bấm vào một ngày trên dải lịch để đánh dấu bù ngày đã qua.',
            },
            {
                en: 'Busy? More options → Rest day keeps the streak for tomorrow or the next few days.',
                vi: 'Bận? Tùy chọn khác → Ngày nghỉ giữ chuỗi cho ngày mai hoặc vài ngày tới.',
            },
        ],
        imageAlt: { en: 'The Habits page', vi: 'Trang Thói quen' },
    },
    {
        id: 'notes',
        shot: 'notes',
        group: { en: 'Notes', vi: 'Ghi chú' },
        title: { en: 'Write notes', vi: 'Viết ghi chú' },
        intro: {
            en: 'Notes save as you type. Add tick boxes, colours, labels and files, and pin what matters.',
            vi: 'Ghi chú tự lưu khi bạn gõ. Thêm ô đánh dấu, màu, nhãn và tệp, ghim những gì quan trọng.',
        },
        instructions: [
            {
                en: 'Linked to attaches a note to a goal or task. Ask AI answers questions from your notes and shows its sources.',
                vi: 'Liên kết với gắn ghi chú vào một mục tiêu hay công việc. Hỏi AI trả lời từ ghi chú của bạn và chỉ rõ nguồn.',
            },
            {
                en: 'Notes also work offline; changes sync when you reconnect.',
                vi: 'Ghi chú dùng được cả khi mất mạng; thay đổi tự đồng bộ khi có mạng lại.',
            },
        ],
        imageAlt: { en: 'The Notes page', vi: 'Trang Ghi chú' },
    },
    {
        id: 'sharing',
        shot: 'note-share',
        group: { en: 'Notes', vi: 'Ghi chú' },
        title: { en: 'Share or lock a note', vi: 'Chia sẻ hoặc khóa ghi chú' },
        intro: {
            en: 'Share a note with other Planner users to read or edit it together live, or protect it with its own password.',
            vi: 'Chia sẻ ghi chú với người dùng Planner khác để cùng xem hoặc cùng sửa trực tiếp, hoặc bảo vệ nó bằng mật khẩu riêng.',
        },
        instructions: [
            {
                en: 'Share → enter emails → View only or Can view and edit → Invite. They accept from the bell.',
                vi: 'Chia sẻ → nhập email → Chỉ xem hoặc Xem và chỉnh sửa → Mời. Người nhận chấp nhận từ chuông thông báo.',
            },
            {
                en: 'Password locks one note. It cannot be recovered, so keep it somewhere safe.',
                vi: 'Mật khẩu khóa riêng một ghi chú. Không thể lấy lại mật khẩu này, hãy cất giữ cẩn thận.',
            },
        ],
        imageAlt: { en: 'The share dialog of a note', vi: 'Hộp thoại chia sẻ ghi chú' },
    },
    {
        id: 'reviews',
        shot: 'reviews',
        group: { en: 'Look back and together', vi: 'Nhìn lại và làm cùng nhau' },
        title: { en: 'Look back with Reviews', vi: 'Nhìn lại với Đánh giá' },
        intro: {
            en: 'A daily, weekly or monthly review gathers what you did; add what went well, what went wrong and what to change next.',
            vi: 'Bản đánh giá ngày, tuần hoặc tháng tổng hợp những gì bạn đã làm; ghi thêm điều đã làm tốt, điều chưa tốt và điều cần thay đổi.',
        },
        instructions: [
            {
                en: 'Refresh facts updates the figures and keeps your words; Finalize closes the review.',
                vi: 'Cập nhật dữ liệu làm mới số liệu mà vẫn giữ phần bạn viết; Hoàn tất để chốt bản đánh giá.',
            },
        ],
        imageAlt: { en: 'A weekly review', vi: 'Một bản đánh giá tuần' },
    },
    {
        id: 'teamwork',
        shot: 'teamwork',
        group: { en: 'Look back and together', vi: 'Nhìn lại và làm cùng nhau' },
        title: { en: 'Work as a team', vi: 'Làm việc nhóm' },
        intro: {
            en: 'A team goal has members, assigned tasks, progress and a chat, separate from your personal plans.',
            vi: 'Mục tiêu nhóm có thành viên, công việc được giao, tiến độ và trò chuyện, tách khỏi kế hoạch cá nhân.',
        },
        instructions: [
            {
                en: 'Roles: Admin manages members, Editor manages tasks, Viewer reads and updates their own tasks.',
                vi: 'Vai trò: Quản trị quản lý thành viên, Biên tập quản lý công việc, Người xem chỉ xem và cập nhật việc của mình.',
            },
        ],
        imageAlt: { en: 'A team goal', vi: 'Một mục tiêu nhóm' },
    },
    {
        id: 'assistant',
        shot: 'assistant',
        group: { en: 'Look back and together', vi: 'Nhìn lại và làm cùng nhau' },
        title: { en: 'Ask the AI assistant', vi: 'Nhờ trợ lý AI' },
        intro: {
            en: 'Ask about your plans, or have the assistant create, move or reschedule things for you.',
            vi: 'Hỏi về kế hoạch, hoặc nhờ trợ lý tạo, di chuyển hay dời lịch giúp bạn.',
        },
        instructions: [
            {
                en: 'Nothing changes until you click Apply on its confirmation card; Cancel drops the proposal.',
                vi: 'Không có gì thay đổi cho đến khi bạn bấm Áp dụng trên thẻ xác nhận; Hủy để bỏ qua.',
            },
        ],
        imageAlt: {
            en: 'The AI assistant with a confirmation card',
            vi: 'Trợ lý AI với thẻ xác nhận thay đổi',
        },
    },
    {
        id: 'more',
        shot: 'archive',
        group: { en: 'Look back and together', vi: 'Nhìn lại và làm cùng nhau' },
        title: { en: 'Settings and the full guide', vi: 'Cài đặt và hướng dẫn đầy đủ' },
        intro: {
            en: 'The gear at the bottom left opens Profile, Appearance, Security, Notifications, Task history, Archive and the User guide.',
            vi: 'Nút bánh răng ở góc dưới bên trái mở Hồ sơ, Giao diện, Bảo mật, Thông báo, Lịch sử công việc, Lưu trữ và Hướng dẫn sử dụng.',
        },
        instructions: [
            {
                en: 'Archived items keep their data: restore them from Settings → Archive.',
                vi: 'Mục đã lưu trữ vẫn giữ dữ liệu: khôi phục trong Cài đặt → Lưu trữ.',
            },
            {
                en: 'The User guide explains every feature step by step, with screenshots.',
                vi: 'Hướng dẫn sử dụng giải thích từng tính năng theo từng bước, kèm ảnh minh họa.',
            },
        ],
        imageAlt: { en: 'The Archive page', vi: 'Trang Lưu trữ' },
    },
];
