const express = require("express");
const methodOverride = require("method-override");
const app = express();
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const passport = require("passport");
const path = require("path");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const fs = require("fs");
const bcrypt = require("bcrypt"); //암호화
const saltRounds = 10;
const router = express.Router();
const AWS = require("@aws-sdk/client-s3");

const moment = require("moment");
require("moment-timezone");
moment.tz.setDefault("Asia/Seoul");
require("dotenv").config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use("/public", express.static("public"));
app.use(methodOverride("_method"));
app.use(
  session({ secret: "비밀코드", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");

let db;

// 날짜
const uploadTime = moment().format("YYYYMMDDHHmmss");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { env } = require("process");

const AWS_S3 = new AWS.S3({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
  },
});

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
  },
});

// let storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     // cb = callback
//     cb(null, "./public/image"); // 저장할 파일을 보낼 경로
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname); // 확장자명(.png, .jpg, .jpeg등)
//     cb(null, path.basename(file.originalname, ext) + uploadTime + ext);
//     // cb(null, file.originalname); // image폴더에 저장할 파일명을 설정 여기선 기본파일명으로 설정
//   },
// });

// let upload = multer({ storage: storage });
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET,
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname); // 확장자명(.png, .jpg, .jpeg등)
      cb(null, path.basename(file.originalname, ext) + uploadTime + ext);
      // cb(null, file.originalname); // image폴더에 저장할 파일명을 설정 여기선 기본파일명으로 설정
      // cb(null, Date.now().toString()); //업로드시 파일명 변경가능
    },
  }),
});

MongoClient.connect(
  process.env.DB_URL,
  { useUnifiedTopology: true },
  (err, client) => {
    if (err) return console.log(err);
    // 연결되면 할 일
    db = client.db("todoapp");

    app.listen(process.env.PORT, () => {
      console.log(`[ ${process.env.PORT} Server Open  ]`);
    });
  }
);

const loginCheck = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.send(
      // history.back(); // 이전 페이지
      `<script>location.href='/login';</script>`
    );
  }
};

// =======  home  =======
app.get("/", (req, res) => {
  Promise.all([
    db.collection("notice").find().toArray(),
    db.collection("post").find().toArray(),
  ])
    .then(([noticeResult, postResult]) => {
      return db
        .collection("comment")
        .find()
        .toArray()
        .then((commentResult) => {
          res.render("index.ejs", {
            notice: noticeResult,
            posts: postResult,
            user: req.user,
            comments: commentResult,
          });
        });
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

// ======= notice =======
app.get("/notice", (req, res) => {
  Promise.all([
    db.collection("notice").find().toArray(),
    db.collection("post").find().toArray(),
  ])
    .then(([noticeResult, postResult]) => {
      return db
        .collection("comment")
        .find()
        .toArray()
        .then((commentResult) => {
          res.render("notice.ejs", {
            notice: noticeResult,
            posts: postResult,
            user: req.user,
            comments: commentResult,
          });
        });
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

// =======  게시물 없을 때  =======
app.get("/noPost", (req, res) => {
  Promise.all([
    db.collection("notice").find().toArray(),
    db.collection("post").find().toArray(),
  ])
    .then(([noticeResult, postResult]) => {
      return db
        .collection("comment")
        .find()
        .toArray()
        .then((commentResult) => {
          res.render("noPost.ejs", {
            notice: noticeResult,
            posts: postResult,
            user: req.user,
            comments: commentResult,
          });
        });
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

// =======  detail  =======
app.get("/detail/:id", (req, res) => {
  const postId = parseInt(req.params.id);

  db.collection("post")
    .findOne({ _id: postId })
    .then((post) => {
      if (!post) {
        return res.status(404).render("404.ejs");
      }
      return db
        .collection("comment")
        .find({ parentAddress: postId })
        .toArray((err, comment) => {
          res.render("detail.ejs", {
            posts: post,
            user: req.user,
            comments: comment,
          });
        });
    })
    .catch((err) => {
      return res.status(500).render("500.ejs");
    });
});

// =======  noticeDetail  =======
app.get("/noticeDetail/:id", (req, res) => {
  const postId = parseInt(req.params.id);

  db.collection("notice")
    .findOne({ _id: postId })
    .then((post) => {
      if (!post) {
        return res.status(404).render("404.ejs");
      }
      return db
        .collection("comment")
        .find({ parentAddress: postId })
        .toArray((err, comment) => {
          res.render("detail.ejs", {
            posts: post,
            user: req.user,
            comments: comment,
          });
        });
    })
    .catch((err) => {
      return res.status(500).render("500.ejs");
    });
});

// =======  comment  =======
app.post("/comment", (req, res) => {
  db.collection("counter").findOne({ name: "댓글갯수" }, (err, result) => {
    let totalComment = result.totalComment;
    console.log(req.body.cmtWriterId);

    let saveComment = {
      cmtNo: totalComment + 1,
      cmtContent: req.body.comment,
      parentAddress: parseInt(req.body.id),
      cmtWriter: req.body.cmtWriter,
      cmtWriterId: req.body.cmtWriterId,
      cmtDate: req.body.cmtTime,
    };
    db.collection("comment").insertOne(saveComment, (err, result) => {
      db.collection("counter").updateOne(
        { name: "댓글갯수" },
        { $inc: { totalComment: 1 } },
        (err, result) => {
          if (err) throw err;
        }
      );
      db.collection("post").updateOne(
        { _id: parseInt(req.body.id) },
        {
          $inc: {
            cmtCount: 1,
          },
        },
        (err, result) => {}
      );
      db.collection("notice").updateOne(
        { _id: parseInt(req.body.id) },
        {
          $inc: {
            cmtCount: 1,
          },
        },
        (err, result) => {}
      );
    });
  });
});

// =======  edit  =======
app.get("/edit/:id", loginCheck, (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) }, // /edit/:id 부분의 값을 가져온다.
    (err, result) => {
      res.render("edit.ejs", {
        posts: result,
        user: req.user,
        isModified: result,
      });
    }
  );
});
app.put("/edit", (req, res) => {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) },
    {
      $set: {
        title: req.body.name,
        content: req.body.content,
        // date: req.body.modifiedDate,
        isModified: true,
      },
    },
    (err, result) => {
      // res.redirect(`/detail/${req.body.id}`);
    }
  );
});

// =======  noticeEdit  =======
app.get("/noticeEdit/:id", loginCheck, (req, res) => {
  db.collection("notice").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      res.render("noticeEdit.ejs", {
        posts: result,
        user: req.user,
        isModified: result,
      });
    }
  );
});
app.put("/noticeEdit", (req, res) => {
  db.collection("notice").updateOne(
    { _id: parseInt(req.body.id) },
    {
      $set: {
        title: req.body.name,
        content: req.body.content,
        // date: req.body.modifiedDate,
        isModified: true,
      },
    },
    (err, result) => {
      // res.redirect(`/detail/${req.body.id}`);
    }
  );
});

// =======  userInfoCheck  =======
app.post("/userInfoCheck", async (req, res) => {
  const userName = req.body.userName;
  console.log(userName);

  const nameRegex = /^[가-힣a-zA-Z\d]{2,15}$/; // 이름 정규식
  const nameErrorMessage = "특수문자를 제외한 2 ~ 15자 이내로 입력해 주세요.";
  const duplicateNameErrorMessage = "이미 사용중인 이름입니다.";
  const okSign = "사용가능한 이름입니다.";

  const existingUserName = await db
    .collection("login")
    .findOne({ name: userName });

  if (!nameRegex.test(userName)) {
    const errorMessage = `<script>alert('${nameErrorMessage}');history.back();</script>`;
    return res.status(400).send(errorMessage);
  }

  try {
    if (existingUserName) {
      // 닉네임 중복 체크
      const errorMessage = `<script>alert('${duplicateNameErrorMessage}');history.back();</script>`;
      return res.status(400).send(errorMessage);
    } else {
      const okMessage = `<script>alert("'${userName}' ${okSign}");history.back();</script>`;
      return res.status(200).send(okMessage);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// =======  userInfoEdit  =======
app.put("/userInfoEdit", (req, res) => {
  db.collection("login").updateOne(
    { id: req.body.id },
    {
      $set: {
        name: req.body.userName,
      },
    },
    console.log(`${req.body.userName}으로 닉변 완료`),
    (err, result) => {
      // res.redirect(`/detail/${req.body.id}`);
    }
  );
  db.collection("post").updateMany(
    // 작성된 모든 게시물에서 작성자 명 변경
    { writerId: req.body.id },
    {
      $set: {
        writer: req.body.userName,
      },
    },
    (err, result) => {
      // res.redirect(`/detail/${req.body.id}`);
    }
  );
  db.collection("comment").updateMany(
    // 작성된 모든 댓글에서 작성자 명 변경
    { cmtWriterId: req.body.id },
    {
      $set: {
        cmtWriter: req.body.userName,
      },
    },
    (err, result) => {
      // res.redirect(`/detail/${req.body.id}`);
    }
  );
});

// =======  signup  =======
app.get("/signup", (req, res) => {
  res.render("signup.ejs", { user: req.user });
});

app.post("/signup", async (req, res) => {
  const nameRegex = /^[가-힣]{2,8}$/; // 이름 정규식
  const idRegex = /^[a-z0-9_-]{6,16}$/; // 아이디 정규식
  const pwRegex = /^(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,16}$/; // 비밀번호 정규식

  const nameErrorMessage = "이름을 2 ~ 8자 이내의 한글로 입력해주세요.";
  const idErrorMessage =
    "아이디는 영문과 숫자로만 구성되어야하며\n 특수문자나 다른 문자는 사용할 수 없습니다.";
  const pwErrorMessage =
    "비밀번호 형식은 영문 최소 하나의 특수문자를 포함하여 6 ~ 16자 사이여야 합니다.";
  const duplicateIdErrorMessage = "이미 사용중인 아이디입니다.";
  const duplicateNameErrorMessage = "이미 사용중인 이름입니다.";

  const userName = req.body.userName;
  const id = req.body.id;
  const pw = req.body.pw;

  if (!nameRegex.test(userName)) {
    const errorMessage = `<script>alert('${nameErrorMessage}');history.back();</script>`;
    return res.status(400).send(errorMessage);
  }

  if (!idRegex.test(id)) {
    const errorMessage = `<script>alert('${idErrorMessage}');history.back();</script>`;
    return res.status(400).send(errorMessage);
  }

  if (!pwRegex.test(pw)) {
    const errorMessage = `<script>alert('${pwErrorMessage}');history.back();</script>`;
    return res.status(400).send(errorMessage);
  }

  try {
    const existingUserId = await db.collection("login").findOne({ id: id });
    const existingUserName = await db
      .collection("login")
      .findOne({ name: userName });

    if (existingUserId) {
      // 아이디 중복 체크
      const errorMessage = `<script>alert('${duplicateIdErrorMessage}');history.back();</script>`;
      return res.status(400).send(errorMessage);
    } else if (existingUserName) {
      // 닉네임 중복 체크
      const errorMessage = `<script>alert('${duplicateNameErrorMessage}');history.back();</script>`;
      return res.status(400).send(errorMessage);
    }

    const hash = await bcrypt.hash(pw, saltRounds);
    await db
      .collection("login")
      .insertOne({ id: id, pw: hash, name: userName });
    const successMessage =
      "<script>alert('회원가입을 완료했습니다.');location.href='/login'</script>";
    res.send(successMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// =======  login  =======
app.get("/login", (req, res) => {
  res.render("login.ejs", { user: req.user });
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (info) {
      return res.send(
        `<script>alert("${info.message}"); window.location.href = "/login";</script>`
      );
    }
    return req.login(user, (loginErr) => {
      // 이 부분 callback 실행
      if (loginErr) {
        return res.send(
          `<script>alert("${info.message}"); window.location.href = "/login";</script>`
        );
      }
      const filteredUser = { ...user.dataValues };
      delete filteredUser.psword;
      return res.redirect("/");
    });
  })(req, res, next);
});

// 로그인 성공시 세션에 저장
passport.serializeUser((user, done) => {
  done(null, user.id); // id를 이용해서 세션을 저장시키는 코드 (로그인 성공시 발동)
});

// 로그인 성공시 세션에 저장된 정보를 가져옴
passport.deserializeUser((id, done) => {
  db.collection("login").findOne({ id: id }, (err, result) => {
    done(null, result);
  });
  // done(null, {}); // 해당 세션 데이터를 가진 사람을 DB에서 찾음 (마이페이지 접속시 발동)
});

passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: true,
      passReqToCallback: false,
    },
    (inputID, inputPW, done) => {
      db.collection("login").findOne({ id: inputID }, (err, result) => {
        if (!result) {
          return done(null, false, { message: "아이디를 확인해주세요." });
        } else {
          bcrypt.compare(inputPW, result.pw, (err, res) => {
            if (res) {
              return done(null, result);
            } else if (result) {
              return done(null, false, { message: "비밀번호를 확인해주세요." });
            }
          });
        }
      });
    }
  )
);

// =======  add  =======
app.post("/add", upload.single("image"), (req, res) => {
  if (req.file) {
    if (req.user.id === "manager") {
      db.collection("counter").findOne({ name: "공지갯수" }, (err, result) => {
        let totalNotice = result.totalNotice;

        let saveItem = {
          _id: totalNotice + 1,
          writerId: req.user.id,
          writer: req.user.name,
          date: req.body.addDate,
          title: req.body.title,
          content: req.body.content,
          cmtCount: 0,
          isModified: false,
          category: "notice",
          upload: req.file.key,
        };

        db.collection("notice").insertOne(saveItem, () => {
          db.collection("counter").updateOne(
            { name: "공지갯수" },
            { $inc: { totalNotice: 1 } },
            (err, result) => {
              if (err) res.sendFile(__dirname + "500.ejs");
            }
          );
        });
      });
    } else {
      db.collection("counter").findOne(
        { name: "게시물갯수" },
        (err, result) => {
          let totalPost = result.totalPost;

          let saveItem = {
            _id: totalPost + 1,
            writerId: req.user.id,
            writer: req.user.name,
            date: req.body.addDate,
            title: req.body.title,
            content: req.body.content,
            cmtCount: 0,
            isModified: false,
            category: "normal",
            upload: req.file.key,
          };

          db.collection("post").insertOne(saveItem, () => {
            db.collection("counter").updateOne(
              { name: "게시물갯수" },
              { $inc: { totalPost: 1 } },
              (err, result) => {
                if (err) res.sendFile(__dirname + "500.ejs");
              }
            );
          });
        }
      );
    }
  } else {
    if (req.user.id === "manager") {
      db.collection("counter").findOne({ name: "공지갯수" }, (err, result) => {
        let totalNotice = result.totalNotice;

        let saveItem = {
          _id: totalNotice + 1,
          writerId: req.user.id,
          writer: req.user.name,
          date: req.body.addDate,
          title: req.body.title,
          content: req.body.content,
          cmtCount: 0,
          isModified: false,
          category: "notice",
        };

        db.collection("notice").insertOne(saveItem, () => {
          db.collection("counter").updateOne(
            { name: "공지갯수" },
            { $inc: { totalNotice: 1 } },
            (err, result) => {
              if (err) res.sendFile(__dirname + "500.ejs");
            }
          );
        });
      });
    } else {
      db.collection("counter").findOne(
        { name: "게시물갯수" },
        (err, result) => {
          let totalPost = result.totalPost;

          let saveItem = {
            _id: totalPost + 1,
            writerId: req.user.id,
            writer: req.user.name,
            date: req.body.addDate,
            title: req.body.title,
            content: req.body.content,
            cmtCount: 0,
            isModified: false,
            category: "normal",
          };

          db.collection("post").insertOne(saveItem, () => {
            db.collection("counter").updateOne(
              { name: "게시물갯수" },
              { $inc: { totalPost: 1 } },
              (err, result) => {
                if (err) res.sendFile(__dirname + "500.ejs");
              }
            );
          });
        }
      );
    }
  }
});
// 파일을 여러개 업로드 하고싶으면 upload.array("image", 5 //최대 업로드 갯수 설정)

app.get("/image/:imageName", (req, res) => {
  res.sendFile(__dirname + "public/image/" + req.params.imageName);
});

// =======  delete  =======
app.delete("/delete", (req, res) => {
  req.body._id = parseInt(req.body._id);

  if (req.body.writerId == req.user.id || req.user.id == "manager") {
    if (req.body.upload) {
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: req.body.upload,
      };
      db.collection("post").deleteOne(req.body, (err, result) => {
        db.collection("comment").deleteMany(
          { parentAddress: req.body._id },
          (err, result) => {
            res.status(200).send({ message: "성공했습니다." });
          }
        );
      });
      AWS_S3.deleteObject(params, (error, data) => {
        if (error) {
          console.error(`S3의 이미지를 삭제하는데 오류 발생: ${error}`);
          res.status(500).send({ error: "에러" });
        } else {
          console.log(`S3에서 ${req.body.upload} 삭제 완료.`);
          res.status(200).send({ message: "이미지 삭제 완료" });
        }
      });
    } else {
      db.collection("post").deleteOne(req.body, (err, result) => {
        db.collection("comment").deleteMany(
          { parentAddress: req.body._id },
          (err, result) => {
            console.log("삭제 성공");
            res.status(200).send({ message: "성공했습니다." });
          }
        );
      });
    }
  } else {
    console.log(req.body.writerId, req.user.id);
    console.log("게시물의 작성자가 아닙니다.");
  }
});

// =======  noticeDelete  =======
app.delete("/noticeDelete", (req, res) => {
  req.body._id = parseInt(req.body._id);

  if (req.body.upload) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: req.body.upload,
    };
    db.collection("notice").deleteOne(req.body, (err, result) => {
      db.collection("comment").deleteMany(
        { parentAddress: req.body._id },
        (err, result) => {
          res.status(200).send({ message: "성공했습니다." });
        }
      );
    });
    AWS_S3.deleteObject(params, (error, data) => {
      if (error) {
        console.error(`S3의 이미지를 삭제하는데 오류 발생: ${error}`);
        res.status(500).send({ error: "에러" });
      } else {
        console.log(`S3에서 ${req.body.upload} 삭제 완료.`);
        res.status(200).send({ message: "이미지 삭제 완료" });
      }
    });
  } else {
    db.collection("notice").deleteOne(req.body, (err, result) => {
      db.collection("comment").deleteMany(
        { parentAddress: req.body._id },
        (err, result) => {
          console.log("삭제 성공");
          res.status(200).send({ message: "성공했습니다." });
        }
      );
    });
  }
});

// =======  cmtDelete  =======
app.delete("/cmtDelete", (req, res) => {
  req.body._id = parseInt(req.body._id);
  req.body.cmtNo = parseInt(req.body.cmtNo);

  db.collection("comment").deleteOne(
    { cmtNo: req.body.cmtNo },
    (err, result) => {
      req.body.cmtNo ? console.log(`${req.body.cmtNo}번 댓글 삭제`) : null;
      db.collection("post").updateOne(
        { _id: req.body._id },
        {
          $inc: {
            cmtCount: -1,
          },
        },
        (err, result) => {}
      );
      db.collection("notice").updateOne(
        { _id: req.body._id },
        {
          $inc: {
            cmtCount: -1,
          },
        },
        (err, result) => {}
      );
      res.status(200).send({ message: "성공했습니다." });
    }
  );
});

// =======  myPage  =======
app.get("/myPage", loginCheck, (req, res) => {
  res.render("myPage.ejs", { user: req.user });
});

// =======  write  =======
app.get("/write", loginCheck, (req, res) => {
  res.render("write.ejs", { user: req.user });
});

// =======  search  =======
app.get("/search", async (req, res) => {
  try {
    const searchValue = req.query.value;

    const searchCondition = [
      {
        $search: {
          index: "title_index",
          text: {
            query: searchValue,
            path: ["title", "writer"],
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const [postResult, noticeResult, commentResult] = await Promise.all([
      db.collection("post").aggregate(searchCondition).toArray(),
      db.collection("notice").find().toArray(),
      db.collection("comment").find().toArray(),
    ]);

    res.render("search.ejs", {
      notice: noticeResult,
      posts: postResult,
      user: req.user,
      comments: commentResult,
    });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// =======  logout  =======
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
      return next(err);
    }
    res.send("<script>location.href='/'</script>");
  });
});

// 에러 처리
app.all("*", function (req, res) {
  res.status(404).render("error.ejs");
});

// app.use("/shop", require("./routes/shop"));
// app.use("/logout", require("./routes/auth"));
