/**
 * policyConfig.js
 * Bảng hạn mức chi tiêu theo cấp bậc nhân viên.
 * 
 * Trong MVP: hardcode ở đây.
 * Trong production: HR/Admin sẽ có giao diện để sửa giá trị.
 */

export const POLICY_LIMITS = {
    ADMIN: {
        label: 'Giám đốc',
        meal_per_day: 1_000_000,
        hotel_per_night: 2_000_000,
        total_per_trip: 20_000_000,
    },
    MANAGER: {
        label: 'Trưởng phòng',
        meal_per_day: 700_000,
        hotel_per_night: 1_500_000,
        total_per_trip: 15_000_000,
    },
    EMPLOYEE: {
        label: 'Nhân viên',
        meal_per_day: 500_000,
        hotel_per_night: 1_000_000,
        total_per_trip: 10_000_000,
    },
};
