const express = require("express");
const methodOverride = require("method-override");
const app = express();
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
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

// =======  home  =======
app.get("/", (req, res) => {
  res.render("index.ejs");
});

// =======  edit  =======
app.get("/edit/:id", (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      res.render("edit.ejs", { posts: result });
    }
  );
});

app.put("/edit", (req, res) => {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) },
    { $set: { title: req.body.title, date: req.body.date } },
    (err, result) => {
      res.redirect("/list");
    }
  );
});

// =======  list  =======
app.get("/list", (req, res) => {
  db.collection("post")
    .find()
    .toArray((err, result) => {
      res.render("list.ejs", { posts: result });
    });
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
    failureRedirect: "/fail",
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
      console.log(입력한아이디, 입력한비번);
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
app.post("/add", (req, res) => {
  res.render("write.ejs");

  db.collection("counter").findOne({ name: "게시물갯수" }, (err, result) => {
    console.log(result.totalPost);
    let totalPost = result.totalPost;

    let saveItem = {
      _id: totalPost + 1,
      name: req.body.title,
      date: req.body.date,
      writer: req.user.name,
    };

    db.collection("post").insertOne(saveItem, () => {
      console.log("저장 완료");
      db.collection("counter").updateOne(
        { name: "게시물갯수" },
        { $inc: { totalPost: 1 } },
        (err, result) => {
          err && console.log(err);
        }
      );
    });
  });
});

// =======  delete  =======
app.delete("/delete", (req, res) => {
  req.body._id = parseInt(req.body._id);

  let deleteItem = { _id: req.body._id, writer: req.user.name };

  db.collection("post").deleteOne(deleteItem, (err, result) => {
    err &&
      res.render(
        "<script>alert('해당 글의 작성자만 삭제가 가능합니다.')</script>"
      );
    res.status(200).send({ message: "성공했습니다." });
  });
  console.log(`=== 삭제한 게시물 번호: ${req.body._id} ===`);
});

// =======  myPage  =======
const loginCheck = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.send(
      // history.back(); // 이전 페이지
      "<script>alert('로그인을 해주세요');location.href='/login';</script>"
    );
  }
};

app.get("/myPage", loginCheck, (req, res) => {
  console.log(req.user);
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
      res.render("search.ejs", { posts: result });
    });
});
