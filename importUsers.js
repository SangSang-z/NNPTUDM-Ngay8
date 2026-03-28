const mongoose = require('mongoose');
const userModel = require('./schemas/users');
const roleModel = require('./schemas/roles');
const { sendPasswordMail } = require('./utils/mailHandler');
const crypto = require('crypto');
const { dataUser } = require('./utils/data2');

// Kết nối DB
mongoose.connect('mongodb://localhost:27017/NNPTUD-S4');

async function getRoleIdByName(name) {
    const role = await roleModel.findOne({ name, isDeleted: false });
    return role ? role._id : null;
}

function genRandomPassword() {
    return crypto.randomBytes(12).toString('base64').slice(0, 16);
}

async function importUsers() {
    for (const u of dataUser) {
        // Chỉ import user có role là 'Người dùng'
        if (u.role && u.role.name === 'Người dùng') {
            const username = u.username;
            const email = u.email;
            const fullName = u.fullName;
            const avatarUrl = u.avatarUrl;
            const status = u.status;
            const loginCount = u.loginCount;
            const roleId = await getRoleIdByName('Người dùng');
            if (!roleId) {
                console.log('Không tìm thấy role Người dùng');
                continue;
            }
            // Sinh mật khẩu ngẫu nhiên
            const password = genRandomPassword();
            // Tạo user
            const existed = await userModel.findOne({ username });
            if (existed) {
                console.log(`User ${username} đã tồn tại, bỏ qua.`);
                continue;
            }
            const newUser = new userModel({
                username,
                password,
                email,
                fullName,
                avatarUrl,
                status,
                loginCount,
                role: roleId
            });
            await newUser.save();
            // Gửi mail
            try {
                await sendPasswordMail(email, password);
                console.log(`Đã gửi mail cho ${email}`);
            } catch (e) {
                console.log(`Gửi mail thất bại cho ${email}:`, e.message);
            }
        }
    }
    mongoose.connection.close();
}

importUsers();