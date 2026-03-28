var express = require("express");
var router = express.Router();
const fs = require("fs");

let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let {
  CreateAnUserValidator,
  validatedResult,
  ModifyAnUser
} = require("../utils/validateHandler");
let userController = require("../controllers/users");
let {
  CheckLogin,
  CheckRole,
  generateRandomPassword
} = require("../utils/authHandler");
let { uploadExcel } = require("../utils/uploadHandler");
let { sendPasswordMail } = require("../utils/mailHandler");
let exceljs = require("exceljs");

router.get("/", CheckLogin, CheckRole("ADMIN"), async function (req, res, next) {
  let users = await userController.GetAllUser();
  res.send(users);
});

router.get("/:id", CheckLogin, CheckRole("ADMIN", "MODERATOR"), async function (req, res, next) {
  try {
    let result = await userModel.find({ _id: req.params.id, isDeleted: false });
    if (result.length > 0) {
      res.send(result);
    } else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username,
      req.body.password,
      req.body.email,
      req.body.role,
      req.body.fullName,
      req.body.avatarUrl,
      req.body.status,
      req.body.loginCount
    );

    let saved = await userModel.findById(newItem._id);
    res.send(saved);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUser, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }

    let populated = await userModel.findById(updatedItem._id);
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }

    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post("/import", uploadExcel.single("file"), async function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "Vui lòng chọn file excel" });
    }

    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).send({ message: "File excel không có sheet nào" });
    }

    const headerRow = worksheet.getRow(1);
    const headers = {};

    headerRow.eachCell((cell, colNumber) => {
      headers[String(cell.value).trim().toLowerCase()] = colNumber;
    });

    const usernameCol = headers["username"];
    const emailCol = headers["email"];

    if (!usernameCol || !emailCol) {
      return res.status(400).send({
        message: "File excel phải có 2 cột: username, email"
      });
    }

    const getCellText = (cell) => {
      if (!cell || cell.value == null) return "";

      if (typeof cell.value === "object") {
        if (cell.value.text) return String(cell.value.text).trim();
        if (cell.value.richText) {
          return cell.value.richText.map(item => item.text).join("").trim();
        }
        return String(cell.text || "").trim();
      }

      return String(cell.value).trim();
    };

    const userRole = await roleModel.findOne({
      name: { $regex: /^user$/i },
      isDeleted: false
    });

    if (!userRole) {
      return res.status(400).send({
        message: "Không tìm thấy role user trong database"
      });
    }

    let results = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      const username = getCellText(row.getCell(usernameCol));
      const email = getCellText(row.getCell(emailCol));

      if (!username || !email) {
        results.push({
          row: rowNumber,
          username,
          email,
          status: "failed",
          message: "Thiếu username hoặc email"
        });
        continue;
      }

      const existedUsername = await userModel.findOne({
        username: username,
        isDeleted: false
      });

      if (existedUsername) {
        results.push({
          row: rowNumber,
          username,
          email,
          status: "failed",
          message: "Username đã tồn tại"
        });
        continue;
      }

      const existedEmail = await userModel.findOne({
        email: email,
        isDeleted: false
      });

      if (existedEmail) {
        results.push({
          row: rowNumber,
          username,
          email,
          status: "failed",
          message: "Email đã tồn tại"
        });
        continue;
      }

      const plainPassword = generateRandomPassword(16);

      let createdUser = await userController.CreateAnUser(
        username,
        plainPassword,
        email,
        userRole._id,
        "",
        "",
        true,
        0
      );

      try {
        await sendPasswordMail({
          to: email,
          username: username,
          password: plainPassword
        });

        results.push({
          row: rowNumber,
          username,
          email,
          status: "success",
          message: "Tạo user và gửi mail thành công"
        });
      } catch (mailError) {
        await userModel.findByIdAndDelete(createdUser._id);

        results.push({
          row: rowNumber,
          username,
          email,
          status: "failed",
          message: "Tạo user thành công nhưng gửi mail thất bại: " + mailError.message
        });
      }
    }

    res.send({
      message: "Import hoàn tất",
      total: results.length,
      results
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

module.exports = router;