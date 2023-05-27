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
const date = new Date();
const year = date.getFullYear();
const month = date.getMonth() + 1;
const day = date.getDate();
const hour = date.getHours();
const minute = date.getMinutes();
const second = date.getSeconds();
const todayDate = `${year}.${month}.${day}`;
const uploadTime = `${year}${month}${day}${hour}${minute}${second}`;
const lastTime = `${hour}${minute}${second}`;

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
      `<script>alert('로그인 후 이용가능합니다.');location.href='/login';</script>`
    );
  }
};

// =======  home  =======
app.get("/", (req, res) => {
  db.collection("post")
    .find()
    .toArray((err, result) => {
      res.render("index.ejs", { posts: result });
    });
});

// =======  edit  =======
app.get("/edit/:id", loginCheck, (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      res.render("edit.ejs", { posts: result, user: req.user });
    }
  );
});

app.put("/edit", (req, res) => {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) },
    { $set: { content: req.body.title, date: todayDate } },
    (err, result) => {
      res.redirect(`/detail/${req.body.id}`);
    }
  );
});

// =======  detail  =======
app.get("/detail/:id", (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    function (err, result) {
      res.render("detail.ejs", { posts: result });
    }
  );
});

// =======  login  =======
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    res.redirect("/");
  }
);

passport.serializeUser((user, done) => {
  done(null, user.id); // id를 이용해서 세션을 저장시키는 코드 (로그인 성공시 발동)
});

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
    (입력한아이디, 입력한비번, done) => {
      db.collection("login").findOne({ id: 입력한아이디 }, (err, result) => {
        if (err) return done(에러);

        if (!result)
          return done(null, false, { message: "존재하지않는 아이디입니다." });
        if (입력한비번 == result.pw) {
          return done(null, result);
        } else {
          return done(null, false, { message: "패스워드를 확인해주세요" });
        }
      });
    }
  )
);

// =======  signup  =======
app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

app.post("/signup", (req, res) => {
  res.render("login.ejs");

  db.collection("login").insertOne(
    { id: req.body.id, pw: req.body.pw, name: req.body.user_name },
    () => {
      console.log("============================");
      console.log(`ID: ${req.body.id}`);
      console.log(`PW: ${req.body.pw}`);
      console.log(`Name: ${req.body.user_name}`);
      console.log("저장 완료");
      console.log("============================");
    }
  );
});

// =======  add  =======
app.post("/add", upload.single("profile"), (req, res) => {
  // res.send(
  //   "<script>alert('게시물이 작성되었습니다.');location.href='/';</script>"
  // );
  if (req.file) {
    db.collection("counter").findOne({ name: "게시물갯수" }, (err, result) => {
      console.log(result.totalPost);
      let totalPost = result.totalPost;
      const fileName = req.file.filename;

      let saveItem = {
        _id: totalPost + 1,
        writer: req.user.name,
        date: todayDate,
        // date: Date.now(),
        name: req.body.title,
        content: req.body.content,
        upload:
          path.basename(fileName, path.extname(fileName)) +
          path.extname(fileName),
      };

      console.log(req.file.filename);
      db.collection("post").insertOne(saveItem, () => {
        console.log("저장 완료");
        db.collection("counter").updateOne(
          { name: "게시물갯수" },
          { $inc: { totalPost: 1 } },
          (err, result) => {
            if (err) throw err;
          }
        );
      });
    });
  } else {
    db.collection("counter").findOne({ name: "게시물갯수" }, (err, result) => {
      console.log(result.totalPost);
      let totalPost = result.totalPost;

      let saveItem = {
        _id: totalPost + 1,
        writer: req.user.name,
        date: todayDate,
        // date: Date.now(),
        name: req.body.title,
        content: req.body.content,
        upload: null,
      };

      db.collection("post").insertOne(saveItem, () => {
        console.log("저장 완료");
        db.collection("counter").updateOne(
          { name: "게시물갯수" },
          { $inc: { totalPost: 1 } },
          (err, result) => {
            if (err) throw err;
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

  // fs.unlink(`./public/image/${req.body.upload}`, (err) => {
  //   try {
  //     if (err) throw new Error();
  //     console.log(`${req.body.upload} 삭제`);
  //   } catch (e) {
  //     console.log(e.message);
  //   }
  // });

  let deleteItem = { value: req.body.value, writer: req.user.name };
  console.log(deleteItem);
  db.collection("post").deleteOne(deleteItem, (err, result) => {});
  // res.status(200).send({ message: "성공했습니다." });
  console.log(`=== 삭제한 게시물 번호: ${req.body._id} ===`);
});

// =======  myPage  =======
app.get("/myPage", loginCheck, (req, res) => {
  res.render("myPage.ejs", { user: req.user });
});

// =======  write  =======
app.get("/write", loginCheck, (req, res) => {
  res.render("write.ejs");
});

// =======  search  =======
app.get("/search", (req, res) => {
  // test1처럼 붙여서 쓰면 검색해도 나오지 않음 test 1이라고 해야 나옴
  let searchCondition = [
    {
      $search: {
        index: "titleSearch",
        text: {
          query: req.query.value,
          path: "name", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
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
      res.render("search.ejs", { posts: result }, { login: result });
    });
});

app.use("/shop", require("./routes/shop"));
