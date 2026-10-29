// Guide copy follows the browser workflows, in English and Vietnamese.
// `theme` picks the illustration; a step may still set its own `image`.
export const walkthroughSteps = [
    {
        id: 'welcome',
        theme: 'mountain',
        group: { en: 'Getting started', vi: 'Bắt đầu' },
        title: { en: 'Make Planner your own', vi: 'Làm quen với Planner' },
        intro: {
            en: 'Turn goals into small steps, keep habits going, and look back on what changed.',
            vi: 'Biến mục tiêu thành những bước nhỏ, duy trì thói quen và nhìn lại những gì đã thay đổi.',
        },
        instructions: [
            {
                en: 'The sidebar opens Dashboard, Goals, Tasks, Habits, Notes, Reviews and Teamwork. On a small screen, open the menu button first.',
                vi: 'Thanh bên mở Dashboard, Mục tiêu, Công việc, Thói quen, Ghi chú, Nhìn lại và Làm việc nhóm. Trên màn hình nhỏ, hãy mở nút menu trước.',
            },
            {
                en: 'The bell shows invitations and due reminders. The ? button opens this guide at any time.',
                vi: 'Chuông hiển thị lời mời và nhắc hẹn đến giờ. Nút ? mở lại hướng dẫn này bất cứ lúc nào.',
            },
            {
                en: 'Change the language, theme and background in Settings → Appearance.',
                vi: 'Đổi ngôn ngữ, giao diện và hình nền trong Cài đặt → Giao diện.',
            },
        ],
    },
    {
        id: 'capture',
        theme: 'mountain',
        group: { en: 'Getting started', vi: 'Bắt đầu' },
        title: { en: 'Capture first, add detail later', vi: 'Ghi lại trước, bổ sung chi tiết sau' },
        intro: {
            en: 'Start with what you know. Every item can be enriched once it becomes clearer.',
            vi: 'Bắt đầu với những gì bạn đã biết. Mọi mục đều có thể bổ sung khi bạn rõ hơn.',
        },
        instructions: [
            {
                en: 'Use New task for something actionable, New goal for an outcome you want, and New note for ideas or research.',
                vi: 'Dùng Công việc mới cho việc cần làm, Mục tiêu mới cho kết quả bạn muốn đạt, và Ghi chú mới cho ý tưởng hay tài liệu.',
            },
            {
                en: 'Creation dialogs keep what you typed when you close them, so you can come back and finish.',
                vi: 'Hộp thoại tạo mới giữ lại nội dung khi bạn đóng, để bạn quay lại hoàn tất sau.',
            },
        ],
    },
    {
        id: 'dashboard-today',
        theme: 'ocean',
        group: { en: 'Dashboard', vi: 'Dashboard' },
        title: { en: 'See what needs attention today', vi: 'Xem việc cần làm hôm nay' },
        intro: {
            en: 'Dashboard → Today gathers today’s work, overdue tasks and your current focus.',
            vi: 'Dashboard → Hôm nay gom công việc trong ngày, việc quá hạn và việc bạn đang tập trung.',
        },
        instructions: [
            {
                en: 'Today lists tasks due, starting or scheduled today; Needs attention lists overdue work.',
                vi: 'Hôm nay liệt kê việc đến hạn, bắt đầu hoặc có lịch trong ngày; Cần chú ý liệt kê việc quá hạn.',
            },
            {
                en: 'The habit streak counts a day only when every daily habit was done or resting, with at least one done.',
                vi: 'Chuỗi thói quen chỉ tính một ngày khi mọi thói quen hằng ngày đều đã làm hoặc đang nghỉ, và có ít nhất một thói quen đã làm.',
            },
            {
                en: 'Current focus picks an open task from your week; complete it right there.',
                vi: 'Việc đang tập trung lấy một việc chưa xong trong tuần; bạn có thể hoàn thành ngay tại đó.',
            },
        ],
    },
    {
        id: 'dashboard-week',
        theme: 'ocean',
        group: { en: 'Dashboard', vi: 'Dashboard' },
        title: {
            en: 'Plan the week and read your activity',
            vi: 'Lên kế hoạch tuần và xem hoạt động',
        },
        intro: {
            en: 'This week shows the tasks and milestones you pinned for the week and every habit with its own streak.',
            vi: 'Tuần này hiển thị công việc và cột mốc bạn đã ghim cho tuần, cùng mọi thói quen với chuỗi riêng.',
        },
        instructions: [
            {
                en: 'Pin a task with the pin icon in Tasks, or use Select for week on a milestone.',
                vi: 'Ghim một việc bằng biểu tượng ghim trong Công việc, hoặc chọn Chọn cho tuần ở một cột mốc.',
            },
            {
                en: 'Activity colours each day by completed tasks, checklist items, habit check-ins and milestones. Hover a day for details.',
                vi: 'Hoạt động tô màu từng ngày theo số việc, mục kiểm tra, lần đánh dấu thói quen và cột mốc đã hoàn thành. Rê chuột lên một ngày để xem chi tiết.',
            },
        ],
    },
    {
        id: 'goals',
        theme: 'mountain',
        group: { en: 'Goals', vi: 'Mục tiêu' },
        title: { en: 'Give your goals a home', vi: 'Sắp xếp mục tiêu theo lĩnh vực' },
        intro: {
            en: 'Areas group goals by part of life. Rename the starting Areas to fit you.',
            vi: 'Lĩnh vực nhóm các mục tiêu theo từng mảng cuộc sống. Hãy đổi tên các lĩnh vực ban đầu cho phù hợp.',
        },
        instructions: [
            {
                en: 'Manage areas renames, adds or removes an Area. An Area can be removed once its goals have moved or been removed.',
                vi: 'Quản lý lĩnh vực cho phép đổi tên, thêm hoặc xóa lĩnh vực. Chỉ xóa được lĩnh vực khi không còn mục tiêu bên trong.',
            },
            {
                en: 'New goal needs a name and an Area; the desired outcome and completion criteria are optional.',
                vi: 'Mục tiêu mới cần tên và lĩnh vực; kết quả mong muốn và tiêu chí hoàn thành có thể bổ sung sau.',
            },
            {
                en: 'Switch between Areas and Timeline. Main goal shows your most important open goal.',
                vi: 'Chuyển giữa Lĩnh vực và Dòng thời gian. Mục tiêu chính là mục tiêu quan trọng nhất chưa hoàn thành.',
            },
        ],
    },
    {
        id: 'roadmap',
        theme: 'mountain',
        group: { en: 'Goals', vi: 'Mục tiêu' },
        title: { en: 'Shape a goal’s roadmap', vi: 'Xây dựng lộ trình cho mục tiêu' },
        intro: {
            en: 'Open a goal to see its milestones leading to the goal name.',
            vi: 'Mở một mục tiêu để thấy các cột mốc dẫn tới tên mục tiêu.',
        },
        instructions: [
            {
                en: 'Select the goal name for its information: Edit goal, Strategy, Related work and Tags.',
                vi: 'Chọn tên mục tiêu để xem thông tin: Sửa mục tiêu, Chiến lược, Công việc liên quan và Thẻ.',
            },
            {
                en: 'Related work shows sub-goals (add one there), direct tasks, repeating work, habits and other goals this goal supports.',
                vi: 'Công việc liên quan hiển thị mục tiêu con (có thể thêm ngay tại đó), việc trực tiếp, việc lặp lại, thói quen và các mục tiêu khác mà mục tiêu này hỗ trợ.',
            },
            {
                en: 'Remove goal removes the goal with its sub-goals, milestones and tasks after you confirm.',
                vi: 'Xóa mục tiêu sẽ xóa cả mục tiêu con, cột mốc và công việc bên trong sau khi bạn xác nhận.',
            },
        ],
    },
    {
        id: 'milestones',
        theme: 'mountain',
        group: { en: 'Goals', vi: 'Mục tiêu' },
        title: { en: 'Work inside a milestone', vi: 'Làm việc trong một cột mốc' },
        intro: {
            en: 'Select a milestone card to see its tasks.',
            vi: 'Chọn một thẻ cột mốc để xem các công việc của nó.',
        },
        instructions: [
            {
                en: 'Add task, Edit, Remove and Select for week sit at the top. Complete milestone when its work is done.',
                vi: 'Thêm công việc, Sửa, Xóa và Chọn cho tuần nằm ở phía trên. Hoàn thành cột mốc khi công việc đã xong.',
            },
            {
                en: 'Prerequisites and related goals: a milestone can wait for others to finish first, and can also support other goals.',
                vi: 'Điều kiện và mục tiêu liên quan: một cột mốc có thể chờ cột mốc khác xong trước, và có thể hỗ trợ thêm mục tiêu khác.',
            },
            {
                en: 'Goal progress is the average of its sub-goals, milestones and direct tasks; a milestone counts once you complete it.',
                vi: 'Tiến độ mục tiêu là trung bình của mục tiêu con, cột mốc và việc trực tiếp; một cột mốc được tính khi bạn hoàn thành nó.',
            },
        ],
    },
    {
        id: 'tasks',
        theme: 'forest',
        group: { en: 'Tasks', vi: 'Công việc' },
        title: { en: 'Capture and find tasks', vi: 'Ghi lại và tìm công việc' },
        intro: {
            en: 'New task can go to your Inbox or straight into a goal or milestone.',
            vi: 'Công việc mới có thể vào Hộp chờ hoặc vào thẳng một mục tiêu hay cột mốc.',
        },
        instructions: [
            {
                en: 'The calendar icon sets a due date, the clock a reminder, and the arrows a repeat. Drag the picker by its handle if it covers something.',
                vi: 'Biểu tượng lịch đặt hạn, đồng hồ đặt nhắc hẹn, mũi tên đặt lặp lại. Kéo hộp chọn bằng thanh nắm nếu nó che mất nội dung.',
            },
            {
                en: 'Today, Next, This week (pinned), Backlog, All and Repeating filter the list; Filter and search adds status, tag and name.',
                vi: 'Hôm nay, Sắp tới, Tuần này (đã ghim), Tồn đọng, Tất cả và Lặp lại giúp lọc danh sách; Lọc và tìm kiếm thêm trạng thái, thẻ và tên.',
            },
            {
                en: 'Remove takes a task off your lists. Completed tasks move to Task history after the time set in Settings.',
                vi: 'Xóa sẽ đưa công việc ra khỏi danh sách. Việc đã hoàn thành chuyển vào Lịch sử công việc sau thời gian bạn đặt trong Cài đặt.',
            },
        ],
    },
    {
        id: 'task-detail',
        theme: 'forest',
        group: { en: 'Tasks', vi: 'Công việc' },
        title: { en: 'Clarify and finish a task', vi: 'Làm rõ và hoàn thành công việc' },
        intro: {
            en: 'Open a task for its details, notes and checklist.',
            vi: 'Mở một công việc để xem chi tiết, ghi chú và danh sách kiểm tra.',
        },
        instructions: [
            {
                en: 'Edit task changes the name, criteria, dates and times (in your local time). Tags save as soon as you tick them.',
                vi: 'Sửa công việc thay đổi tên, tiêu chí, ngày và giờ (theo giờ địa phương). Thẻ được lưu ngay khi bạn chọn.',
            },
            {
                en: 'The checklist can be added to, renamed and cleaned up. Completing a task with open items asks you first.',
                vi: 'Danh sách kiểm tra có thể thêm, đổi tên và xóa mục. Hoàn thành công việc khi còn mục chưa xong sẽ được hỏi lại.',
            },
            {
                en: 'Related work links other goals this task also moves forward.',
                vi: 'Công việc liên quan liên kết các mục tiêu khác mà công việc này cũng góp phần.',
            },
        ],
    },
    {
        id: 'recurring',
        theme: 'forest',
        group: { en: 'Tasks', vi: 'Công việc' },
        title: { en: 'Repeat work on a schedule', vi: 'Lặp lại công việc theo lịch' },
        intro: {
            en: 'The repeat icon creates a series that adds a task for each date.',
            vi: 'Biểu tượng lặp lại tạo một chuỗi, tự thêm công việc cho từng ngày.',
        },
        instructions: [
            {
                en: 'Choose Daily, Weekdays, Weekly, Monthly, Yearly or Custom. A reminder repeats at the same time on every occurrence.',
                vi: 'Chọn Hằng ngày, Ngày trong tuần, Hằng tuần, Hằng tháng, Hằng năm hoặc Tùy chỉnh. Nhắc hẹn lặp lại vào cùng giờ ở mỗi lần.',
            },
            {
                en: 'Tasks → Repeating lists every series. Pause, Resume or End it there.',
                vi: 'Công việc → Lặp lại liệt kê mọi chuỗi. Tạm dừng, Tiếp tục hoặc Kết thúc tại đó.',
            },
        ],
    },
    {
        id: 'habits',
        theme: 'forest',
        group: { en: 'Habits', vi: 'Thói quen' },
        title: { en: 'Keep a habit going', vi: 'Duy trì thói quen' },
        intro: {
            en: 'Create a daily or weekly habit, optionally linked to a goal and tagged.',
            vi: 'Tạo thói quen hằng ngày hoặc hằng tuần, có thể gắn với một mục tiêu và gắn thẻ.',
        },
        instructions: [
            {
                en: 'The round tick opens Mark today as done, and Rest day for one of the next 3 days. Today and past days cannot become rest days.',
                vi: 'Nút tích tròn mở Đánh dấu hoàn thành hôm nay, và Ngày nghỉ cho một trong 3 ngày tới. Không đặt ngày nghỉ cho hôm nay hoặc ngày đã qua.',
            },
            {
                en: 'A rest day keeps your streak but never adds to it. Cancel a future rest day to move it.',
                vi: 'Ngày nghỉ giữ chuỗi nhưng không cộng thêm. Hủy một ngày nghỉ tương lai để chuyển sang ngày khác.',
            },
            {
                en: 'Dots show the last 7 days and the next 3; tap a past day to fix a check-in. Edit and Delete sit beside each habit.',
                vi: 'Các chấm hiển thị 7 ngày qua và 3 ngày tới; chạm vào ngày đã qua để sửa đánh dấu. Sửa và Xóa nằm cạnh mỗi thói quen.',
            },
        ],
    },
    {
        id: 'notes',
        theme: 'stars',
        group: { en: 'Notes', vi: 'Ghi chú' },
        title: { en: 'Write and keep ideas', vi: 'Viết và lưu giữ ý tưởng' },
        intro: {
            en: 'Notes save automatically once the server confirms them.',
            vi: 'Ghi chú tự lưu khi máy chủ xác nhận.',
        },
        instructions: [
            {
                en: 'Add tags, colours, a pin and files. Check box turns lines into tickable items.',
                vi: 'Thêm thẻ, màu, ghim và tệp đính kèm. Nút Ô đánh dấu biến dòng thành mục có thể tích.',
            },
            {
                en: 'Search, sort and filter by tag. If a draft was left unsaved, you can recover or discard it.',
                vi: 'Tìm kiếm, sắp xếp và lọc theo thẻ. Nếu còn bản nháp chưa lưu, bạn có thể khôi phục hoặc bỏ đi.',
            },
        ],
    },
    {
        id: 'sharing',
        theme: 'stars',
        group: { en: 'Notes', vi: 'Ghi chú' },
        title: { en: 'Share a note', vi: 'Chia sẻ ghi chú' },
        intro: {
            en: 'Share invites someone by email to view or edit a note.',
            vi: 'Chia sẻ mời một người qua email để xem hoặc sửa ghi chú.',
        },
        instructions: [
            {
                en: 'They see it under Shared with me after accepting. Change their permission or remove them at any time.',
                vi: 'Họ thấy ghi chú trong mục Được chia sẻ với tôi sau khi chấp nhận. Bạn có thể đổi quyền hoặc gỡ họ bất cứ lúc nào.',
            },
            {
                en: 'A shared note can be left or reported to the administrator.',
                vi: 'Bạn có thể rời một ghi chú được chia sẻ hoặc báo cáo cho quản trị viên.',
            },
        ],
    },
    {
        id: 'reviews',
        theme: 'pisces',
        group: { en: 'Reviews', vi: 'Nhìn lại' },
        title: { en: 'Look back and plan ahead', vi: 'Nhìn lại và lên kế hoạch' },
        intro: {
            en: 'A review captures the facts of a day, week or month, plus your reflections.',
            vi: 'Một lần nhìn lại ghi lại dữ kiện của một ngày, tuần hoặc tháng, cùng suy ngẫm của bạn.',
        },
        instructions: [
            {
                en: 'Facts are a snapshot; Refresh facts updates them. Write the four reflections and Save.',
                vi: 'Dữ kiện là ảnh chụp tại một thời điểm; Làm mới dữ kiện để cập nhật. Viết bốn phần suy ngẫm rồi Lưu.',
            },
            {
                en: 'Finalize makes a review read-only until you Reopen it. Delete removes it for good.',
                vi: 'Hoàn tất khiến bản nhìn lại chỉ đọc cho tới khi bạn Mở lại. Xóa sẽ xóa vĩnh viễn.',
            },
        ],
    },
    {
        id: 'teamwork',
        theme: 'ocean',
        group: { en: 'Teamwork', vi: 'Làm việc nhóm' },
        title: { en: 'Work towards a shared goal', vi: 'Cùng hướng tới mục tiêu chung' },
        intro: {
            en: 'A team goal has members, assigned tasks and a chat.',
            vi: 'Mục tiêu nhóm có thành viên, công việc được giao và khung trò chuyện.',
        },
        instructions: [
            {
                en: 'Invite members as Viewer, Editor or Admin. They join after accepting the invitation.',
                vi: 'Mời thành viên với vai trò Người xem, Người sửa hoặc Quản trị. Họ tham gia sau khi chấp nhận lời mời.',
            },
            {
                en: 'Assign tasks with due dates and reminders; members see completion per person.',
                vi: 'Giao việc kèm hạn và nhắc hẹn; mọi người thấy mức hoàn thành của từng thành viên.',
            },
        ],
    },
    {
        id: 'reminders',
        theme: 'stars',
        group: { en: 'Notifications', vi: 'Thông báo' },
        title: { en: 'Stay on top of reminders', vi: 'Không bỏ lỡ nhắc hẹn' },
        intro: {
            en: 'Due reminders and invitations appear in the bell.',
            vi: 'Nhắc hẹn đến giờ và lời mời xuất hiện trong chuông thông báo.',
        },
        instructions: [
            {
                en: 'Opening a reminder dismisses it; Mark all read clears the bell. A new reminder time brings it back.',
                vi: 'Mở một nhắc hẹn sẽ ẩn nó; Đánh dấu đã đọc tất cả sẽ dọn chuông. Đặt giờ nhắc mới thì nhắc hẹn hiện lại.',
            },
            {
                en: 'Settings → Notifications turns notifications and email reminders on or off.',
                vi: 'Cài đặt → Thông báo bật hoặc tắt thông báo và nhắc hẹn qua email.',
            },
        ],
    },
    {
        id: 'account',
        theme: 'pisces',
        group: { en: 'Account', vi: 'Tài khoản' },
        title: { en: 'Profile, security and appearance', vi: 'Hồ sơ, bảo mật và giao diện' },
        intro: {
            en: 'Your name in the sidebar opens your profile and settings.',
            vi: 'Tên của bạn ở thanh bên mở hồ sơ và cài đặt.',
        },
        instructions: [
            {
                en: 'Profile: picture, name, a short bio for teammates, email verification and changing your email.',
                vi: 'Hồ sơ: ảnh, tên, giới thiệu ngắn cho đồng đội, xác minh email và đổi email.',
            },
            {
                en: 'Security: change your password and turn on two-step verification by email or an authenticator app.',
                vi: 'Bảo mật: đổi mật khẩu và bật xác minh hai bước qua email hoặc ứng dụng xác thực.',
            },
            {
                en: 'Appearance: themes, light or dark, your own images or colour, the quote, and the language.',
                vi: 'Giao diện: chủ đề, sáng hoặc tối, ảnh hay màu của riêng bạn, câu trích dẫn và ngôn ngữ.',
            },
        ],
    },
];
