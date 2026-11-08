import { translate } from "./i18n";
import type { GuestLocale } from "./auth-input";
import { ApiError } from "./api";

const extra: Record<string, string> = {
    "Preview complete. No account data was changed.":
        "Đã xem xong luồng minh họa. Không có dữ liệu tài khoản nào thay đổi.",
    "Email verification": "Xác minh email",
    "Use at least 12 characters.": "Dùng ít nhất 12 ký tự.",
    "Enter your password.": "Nhập mật khẩu của bạn.",
    "Use no more than 128 characters.": "Dùng không quá 128 ký tự.",
    "Enter a display name of up to 80 characters.":
        "Nhập tên hiển thị, tối đa 80 ký tự.",
    "Enter a valid email address.": "Nhập địa chỉ email hợp lệ.",
    "Passwords do not match.": "Mật khẩu xác nhận chưa khớp.",
    "Enter the six-digit code.": "Nhập mã gồm 6 chữ số.",
    "Email or password is incorrect": "Email hoặc mật khẩu chưa đúng.",
    "Incorrect verification code": "Mã xác thực chưa đúng.",
    "Unable to create an account with these details":
        "Không thể tạo tài khoản với thông tin này. Kiểm tra thông tin hoặc thử đăng nhập.",
    "Code is invalid or has expired. Request a new one.":
        "Mã không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.",
    "This link or challenge expired. Request a new one.":
        "Liên kết hoặc phiên xác thực đã hết hạn. Hãy yêu cầu liên kết mới.",
    "This challenge expired. Sign in again.":
        "Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.",
    "Too many attempts. Try again later.":
        "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.",
    "Check the fields and try again.":
        "Kiểm tra các trường thông tin rồi thử lại.",
    "Connection lost. Your entries have been kept. Try again.":
        "Mất kết nối. Thông tin đã nhập vẫn được giữ. Vui lòng thử lại.",
    "Open the complete link from your email, or request a new one.":
        "Mở liên kết đầy đủ trong email, hoặc yêu cầu liên kết mới.",
    "If the account is eligible, a recovery email will arrive shortly.":
        "Nếu tài khoản đủ điều kiện, bạn sẽ sớm nhận được email khôi phục.",
    "Password reset. Sign in with your new password.":
        "Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới để tiếp tục.",
    "Email verified. Your account is ready.":
        "Email đã được xác minh. Tài khoản của bạn đã sẵn sàng.",
    "Check your email for the verification code.":
        "Kiểm tra email để nhận mã xác thực.",
    "Sending…": "Đang gửi…",
    "Signing in…": "Đang đăng nhập…",
    "Creating account…": "Đang tạo tài khoản…",
    "Verifying…": "Đang xác thực…",
    "Resetting password…": "Đang đặt lại mật khẩu…",
    "Checking your link…": "Đang kiểm tra liên kết…",
    "This migrated account requires assisted MFA recovery before login":
        "Tài khoản chuyển đổi này cần khôi phục xác thực hai bước trước khi đăng nhập. Vui lòng liên hệ người quản trị.",
    "Account is unavailable": "Tài khoản hiện không khả dụng.",
};
export const authText = (message: string, locale: GuestLocale) =>
    translate(message, locale, extra[message] || message);
export function authError(error: unknown) {
    const message =
        error instanceof ApiError
            ? error.message
            : "Connection lost. Your entries have been kept. Try again.";
    return message;
}
