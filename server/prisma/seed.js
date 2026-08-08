/**
 * seed.js — Tạo dữ liệu demo cho FlexiTrip.
 * Chạy: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...\n');

    // ──────── Users ────────
    const hashedAdmin = await bcrypt.hash('admin123', 10);
    const hashedEmployee = await bcrypt.hash('employee123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@company.vn' },
        update: {},
        create: {
            email: 'admin@company.vn',
            password: hashedAdmin,
            name: 'Nguyễn Admin',
            role: 'ADMIN',
            department: 'Ban Giám Đốc',
            walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat #0
        },
    });
    console.log('  ✅ Admin:', admin.email);

    const employeeA = await prisma.user.upsert({
        where: { email: 'nguyenvana@company.vn' },
        update: {},
        create: {
            email: 'nguyenvana@company.vn',
            password: hashedEmployee,
            name: 'Nguyễn Văn A',
            role: 'EMPLOYEE',
            department: 'Phòng Kinh Doanh',
            walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat #1
        },
    });
    console.log('  ✅ Employee:', employeeA.email);

    const managerB = await prisma.user.upsert({
        where: { email: 'tranthib@company.vn' },
        update: {},
        create: {
            email: 'tranthib@company.vn',
            password: hashedEmployee,
            name: 'Trần Thị B',
            role: 'MANAGER',
            department: 'Phòng Nhân Sự',
            walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Hardhat #2
        },
    });
    console.log('  ✅ Manager:', managerB.email);

    // ──────── Trips ────────
    const trip = await prisma.trip.create({
        data: {
            userId: employeeA.id,
            destination: 'Đà Nẵng',
            workLocation: 'Công ty ABC, 123 Nguyễn Văn Linh, Đà Nẵng',
            purpose: 'Họp đối tác + khảo sát thị trường',
            startDate: new Date('2026-07-28'),
            endDate: new Date('2026-07-31'),
            budget: 5_000_000,
            status: 'ONGOING',
        },
    });
    console.log('  ✅ Trip:', trip.destination, `(${trip.budget.toLocaleString()}đ budget)`);

    console.log('\n🎉 Seed complete!');
    console.log('\n  📋 Demo accounts:');
    console.log('  admin@company.vn      / admin123     (Admin)');
    console.log('  nguyenvana@company.vn  / employee123  (Employee)');
    console.log('  tranthib@company.vn    / employee123  (Manager)');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
