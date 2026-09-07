/**
 * seed.js — Tạo dữ liệu demo cho FlexiTrip.
 * Chạy: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...\n');

    // ──────── Departments ────────
    const deptBoard = await prisma.department.upsert({
        where: { name: 'Ban Giám Đốc' },
        update: {},
        create: { name: 'Ban Giám Đốc', description: 'Ban lãnh đạo cấp cao' },
    });

    const deptSales = await prisma.department.upsert({
        where: { name: 'Phòng Kinh Doanh' },
        update: {},
        create: { name: 'Phòng Kinh Doanh', description: 'Phòng phát triển kinh doanh' },
    });

    const deptHR = await prisma.department.upsert({
        where: { name: 'Phòng Nhân Sự' },
        update: {},
        create: { name: 'Phòng Nhân Sự', description: 'Phòng quản lý nhân sự' },
    });
    console.log('  ✅ Departments seeded.');

    // ──────── Policy Limits ────────
    const policyAdmin = await prisma.policyLimit.upsert({
        where: { role: 'ADMIN' },
        update: { dailyLimit: 20000000, perInvoiceLimit: 10000000, totalPerTripLimit: 50000000 },
        create: { role: 'ADMIN', dailyLimit: 20000000, perInvoiceLimit: 10000000, totalPerTripLimit: 50000000 },
    });

    const policyManager = await prisma.policyLimit.upsert({
        where: { role: 'MANAGER' },
        update: { dailyLimit: 10000000, perInvoiceLimit: 5000000, totalPerTripLimit: 30000000 },
        create: { role: 'MANAGER', dailyLimit: 10000000, perInvoiceLimit: 5000000, totalPerTripLimit: 30000000 },
    });

    const policyEmployee = await prisma.policyLimit.upsert({
        where: { role: 'EMPLOYEE' },
        update: { dailyLimit: 5000000, perInvoiceLimit: 2000000, totalPerTripLimit: 15000000 },
        create: { role: 'EMPLOYEE', dailyLimit: 5000000, perInvoiceLimit: 2000000, totalPerTripLimit: 15000000 },
    });
    console.log('  ✅ PolicyLimits seeded.');

    // ──────── Expense Categories ────────
    const catRest = await prisma.expenseCategory.upsert({
        where: { code: 'restaurant' },
        update: {},
        create: { code: 'restaurant', name: 'Nhà hàng / Ăn uống', requireTaxId: false },
    });

    const catHotel = await prisma.expenseCategory.upsert({
        where: { code: 'hotel' },
        update: {},
        create: { code: 'hotel', name: 'Khách sạn / Lưu trú', requireTaxId: true },
    });

    const catTrans = await prisma.expenseCategory.upsert({
        where: { code: 'taxi' },
        update: {},
        create: { code: 'taxi', name: 'Di chuyển / Taxi', requireTaxId: false },
    });
    console.log('  ✅ ExpenseCategories seeded.');

    // ──────── Users & Wallets ────────
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
            departmentId: deptBoard.id,
            walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Giữ legacy field
            wallet: {
                create: {
                    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    balance: 0
                }
            }
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
            departmentId: deptSales.id,
            walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            wallet: {
                create: {
                    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                    balance: 0
                }
            }
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
            departmentId: deptHR.id,
            walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            wallet: {
                create: {
                    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
                    balance: 0
                }
            }
        },
    });
    console.log('  ✅ Manager:', managerB.email);

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
