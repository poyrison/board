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

let multer = require("multer");

let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // cb = callback
    cb(null, "./public/image"); // 저장할 파일을 보낼 경로
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // 확장자명(.png, .jpg, .jpeg등)
    cb(null, path.basename(file.originalname, ext) + uploadTime + ext);
    // cb(null, file.originalname); // image폴더에 저장할 파일명을 설정 여기선 기본파일명으로 설정
  },
});

let upload = multer({ storage: storage });

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
  db.collection("post")
    .find()
    .toArray((err, result) => {
      db.collection("comment")
        .find()
        .toArray((err, result2) => {
          res.render("index.ejs", {
            posts: result,
            user: req.user,
            comments: result2,
          });
        });
      console.log(result);
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

// =======  comment  =======
app.post("/comment", (req, res) => {
  db.collection("counter").findOne({ name: "댓글갯수" }, (err, result) => {
    let totalComment = result.totalComment;

    let saveComment = {
      cmtNo: totalComment + 1,
      cmtContent: req.body.comment,
      parentAddress: parseInt(req.body.id),
      cmtWriter: req.body.cmtWriter,
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
        // date: req.body.date.includes("수정됨")
        //   ? `${req.body.date}`
        //   : `${req.body.date}(수정됨)`,
        date: req.body.date,
        isModified: req.body.isModified === false && true,
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
    const existingUser = await db.collection("login").findOne({ id: id });
    if (existingUser) {
      const errorMessage = `<script>alert('${duplicateIdErrorMessage}');history.back();</script>`;
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
app.post("/add", upload.single("profile"), (req, res) => {
  if (req.file) {
    db.collection("counter").findOne({ name: "게시물갯수" }, (err, result) => {
      let totalPost = result.totalPost;
      const fileName = req.file.filename;

      let saveItem = {
        _id: totalPost + 1,
        writerId: req.user.id,
        writer: req.user.name,
        date: req.body.addDate,
        title: req.body.title,
        content: req.body.content,
        cmtCount: 0,
        isModified: false,
        upload:
          path.basename(fileName, path.extname(fileName)) +
          path.extname(fileName),
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
    });
  } else {
    db.collection("counter").findOne({ name: "게시물갯수" }, (err, result) => {
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
    });
  }
});
// 파일을 여러개 업로드 하고싶으면 upload.array("profile", 5 //최대 업로드 갯수 설정)

app.get("/image/:imageName", (req, res) => {
  res.sendFile(__dirname + "public/image/" + req.params.imageName);
});

// =======  delete  =======
app.delete("/delete", (req, res) => {
  req.body._id = parseInt(req.body._id);

  let deleteItem = { writerId: req.body, user: req.user.id };
  if (req.body.writerId == req.user.id || req.user.id == "manager") {
    if (req.body.upload) {
      db.collection("post").deleteOne(req.body, (err, result) => {
        db.collection("comment").deleteMany(
          { parentAddress: req.body._id },
          (err, result) => {
            console.log(`${req.body._id}번 게시물 삭제`);
            res.status(200).send({ message: "성공했습니다." });
          }
        );
      });
      fs.unlink(`./public/image/${req.body.upload}`, (err) => {
        try {
          if (err) throw new Error();
          console.log(`${req.body.upload} 삭제`);
        } catch (e) {
          console.log(e.message);
        }
      });
    } else {
      db.collection("post").deleteOne(req.body, (err, result) => {
        db.collection("comment").deleteMany(
          { parentAddress: req.body._id },
          (err, result) => {
            console.log(`${req.body._id}번 게시물 삭제`);
            res.status(200).send({ message: "성공했습니다." });
          }
        );
      });
    }
  } else {
    console.log("게시물의 작성자가 아닙니다.");
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
app.get("/search", (req, res) => {
  // test1처럼 붙여서 쓰면 검색해도 나오지 않음 test 1이라고 해야 나옴
  let searchCondition = [
    {
      $search: {
        index: "title_index",
        text: {
          query: req.query.value,
          path: "title", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
    // {$sort : {_id:-1}}, //_id:1 오름차순으로 결과 출력 -1은 내림차순 결과 출력
    // {$limit : 2},
  ];
  db.collection("post")
    .aggregate(searchCondition)
    .toArray((err, result) => {
      console.log(result);
      res.render("search.ejs", { posts: result, user: req.user });
    });
});
// app.get('/search', async (req, res) => {
//   let result = await db.collection("post").find({$text : {req.query.value}})
// })

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
