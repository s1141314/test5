//variable
var http = require('http');
var url  = require('url');
var assert = require('assert');

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://user:user@ds125113.mlab.com:25113/cecilia0121';

var session = require('cookie-session');
var express = require('express');
var fileUpload = require('express-fileupload');
var app = express();
var bodyParser = require('body-parser');

//middlewares
app.use(session({cookieName: 'session',keys: ['Cecilia','Julian ']}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(fileUpload());

//register
app.get('/register', function(req,res,callback){
	res.render('register.ejs');
	//res.sendFile(__dirname + '/public/register.html');
});

app.post('/register', function(req, res) {
	var criteria = {"name" : req.body.name};
	MongoClient.connect(mongourl,function(err,db) {
	assert.equal(null,err);
		findUser(db,criteria,function(result){	
			if(result == null){
				createUser(db,req.body.name,req.body.pw,
					function(result) {
						db.close();
						res.redirect('/');
					} 
				);
			}
			else{
				res.redirect('/register');
			}
		});
	});
});
		
function createUser(db,name,pw,callback) {
	db.collection('user').insertOne({
	"name" : name,
	"password" : pw
	}, function(err,result) {
		if (err) {result = err;}
		callback(result);
	}
	);
}

//login
app.get('/',function(req,res) {
	if (!req.session.authenticated) {
		//res.sendFile(__dirname + '/public/login.html');
		res.render('login.ejs');
	}
	else{
		res.redirect('/read');
	}
});

app.post('/login',function(req,res) {
	var user = req.body.name;
	var pw = req.body.pw;	
	var criteria = {"name" : user};
	if (req.body.name != ''){
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		findUser(db,criteria,function(result){
			console.log(JSON.stringify(result));
			if (result == null){
				res.redirect('/');
			} else if(result.name == user && result.password == pw){
				req.session.authenticated = true;
				req.session.username = req.body.name;
				res.redirect('/');
			} else {
				res.redirect('/');
			}
		});
	});
	} else {
		res.redirect('/');
	}
});

function findUser(db,criteria,callback) {
	db.collection('user').findOne(criteria,
		function(err,result) {
			assert.equal(err,null);
			callback(result);
		}
	)
}

//logout
app.get('/logout', function(req,res,next) {
	req.session = null;
	res.redirect('/');
});

//create
app.get('/new',function(req,res) {
	if (!req.session.authenticated) {
		//res.sendFile(__dirname + '/public/login.html');
		res.render('login.ejs');
	} else {
		//res.sendFile(__dirname + '/public/create.html');
		res.render('create.ejs');
	}
});

app.post('/create', function(req, res) {
	var criteria = {"name" : req.body.name};
	MongoClient.connect(mongourl,function(err,db) {
	  assert.equal(null,err);
    	  findOneRestaurant(db,criteria,function(dbres) {
	    if(dbres == null){
		create(db, req.session.username, req.body.name, req.body.borough, req.body.cuisine, req.body.street, req.body.building, req.body.zipcode, req.body.lon, req.body.lat, req.files.sampleFile,
		  function(result) {
	        	db.close();
		  if (result.insertedId != null) {
			res.status(200);
			res.redirect('/');
		  } else {
			res.status(500);
			res.end(JSON.stringify(result));
						}
 		  }
		);
	     } else {
			res.redirect('/new');
	     }
	    });
	});
});

function create(db,owner,name,borough,cuisine,street,building,zipcode,lon,lat,bfile,callback) {
	db.collection('res').insertOne({
	"owner" : owner,
	"borough" : borough,
	"name" : name,
 	"cuisine" : cuisine,
	"street" : street,
	"building" : building,
	"coor" : [lon,lat],
	"data" : new Buffer(bfile.data).toString('base64'),
	"mimetype" : bfile.mimetype
	}, 
		function(err,result) {
			if (err) {
				result = err;
				console.log("insertOne error: " + JSON.stringify(err));
			} else {
		  		console.log("status : OK,");
				console.log("_id : " + result.insertedId);
			}
			callback(result);
		}
	);
}

function findOneRestaurant(db,criteria,callback) {
		db.collection('res').findOne(criteria,function(err,result) {
			assert.equal(err,null);
			callback(result);
		}
	);
}

//read
app.get('/read', function(req,res) {
	if (!req.session.authenticated) {
		//res.sendFile(__dirname + '/public/login.html');
		res.render('login.ejs');
	} else {
	  var criteria = req.query;
	  console.log("Authenticated: " + req.session.authenticated + "; Username: " + req.session.username);
  	  MongoClient.connect(mongourl,function(err,db) {
	  assert.equal(err,null);
		console.log('Connected to Database');
		findRestaurant(db,criteria,function(dbres) {
			db.close();
			res.render('list.ejs',{res:dbres,user:req.session.username,criteria:JSON.stringify(criteria)});
		});
	});
	}
});

//api/read
app.get('/api/read/:field/:value', function(req,res) {
	if (!req.session.authenticated) {
		//res.sendFile(__dirname + '/public/login.html');
		res.render('login.ejs');
	} else {
	  var criteria = req.query;
	  console.log("Authenticated: " + req.session.authenticated + "; Username: " + req.session.username);
  	  MongoClient.connect(mongourl,function(err,db) {
	  	assert.equal(err,null);
		var field = req.params.field;
		var value = req.params.value;
		var criteria;
		if (field == "name"){
			criteria = {"name":value};
		}else if (field == "borough"){
			criteria = {"borough":value};
		}else if (field == "cuisine"){
			criteria == {"cuisine":value};
		}
		console.log('Connected to Database');
		console.log("Restaurant in:" + value);
		findRestaurant(db,criteria,function(dbres) {
			db.close();
			res.end(JSON.stringify(dbres));
		});
	});
	}
});

function findRestaurant(db,criteria,callback) {
		var dbres = [];
		db.collection('res').find(criteria,function(err,result) {
			assert.equal(err,null);
			result.each(function(err,doc) {
				if (doc != null) {
					dbres.push(doc);
				} else {
					callback(dbres);
				}
			});
		})
}

//detail
app.get('/detail', function(req,res) {
	if (!req.session.authenticated) {
		//res.sendFile(__dirname + '/public/login.html');
		res.render('login.ejs');
	} else {
	 	var target = req.query.id;
		MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		findDetail(db,target,function(dbres) {
			db.close();
			res.render('showOne.ejs',{rest:dbres});
		});
		});
	}
});

function findDetail(db,target,callback) {
		db.collection('res').findOne({"_id": ObjectId(target)},function(err,result) {
			assert.equal(err,null);
			callback(result);
		});
}

//change
app.get('/change',function(req,res) {
	if (!req.session.authenticated) {
		res.render('login.ejs');
		//res.sendFile(__dirname + '/public/login.html');
	}
	else{
		MongoClient.connect(mongourl,function(err,db) {
			assert.equal(err,null);
			changeInfo(db,req.query.id,function(result) {
				db.close();
				if(result.owner!=req.session.username)
					res.render('error.ejs');
					//res.sendFile(__dirname + '/public/error.html');
				else{
					res.render('change.ejs',{result:result});
				}
			}
		);
		});
	}
});

function changeInfo(db,target,callback) {
		db.collection('res').findOne({"_id": ObjectId(target)},function(err,result) {
			assert.equal(err,null);
			callback(result);
		});
}

app.post('/change', function(req, res) {
	MongoClient.connect(mongourl,function(err,db) {
	assert.equal(null,err);
		commitChange(db,req.body.id, req.body.name, req.body.borough, req.body.cuisine, req.body.street, req.body.building, req.body.zipcode, req.body.lon, req.body.lat, req.files.sampleFile,
			function(result) {
		 		db.close();
				res.status(200);
				res.redirect('/detail?id=' + req.body.id);
			}
		);
	});
});

function commitChange(db,id,name,borough,cuisine,street,building,zipcode,lon,lat,bfile,callback) {
	if(bfile.name!= ''){
	db.collection('res').update({"_id": ObjectId(id)},{$set:{
	"name" : name,
	"borough" : borough,
 	"cuisine" : cuisine,
	"street" : street,
	"building" : building,
	"coor" : [lon,lat],
	"data" : new Buffer(bfile.data).toString('base64'),
	"mimetype" : bfile.mimetype
	}}, function(err,result) {
		if (err) {
			result = err;
			console.log("insertOne error: " + JSON.stringify(err));
		} else {
			callback(result);
		} 
	}
	);
	}else{
	   db.collection('res').update({"_id": ObjectId(id)},{$set:{
		"name" : name,
		"borough" : borough,
 		"cuisine" : cuisine,
		"street" : street,
		"building" : building,
		"coor" : [lon,lat]
	    }}, function(err,result) {
		if (err) {
			result = err;
			console.log("insertOne error: " + JSON.stringify(err));
		} else {
	  		callback(result);
		}
		
	    }
	);
    }
}

//rate
app.post('/rate',function(req,res) {
	var resID = req.body.id;
	var resScore = req.body.score;
	var rateOwner = req.session.username;
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to Database');
		addRate(db,resID,resScore,rateOwner,
		function(result) {
			  db.close();
			  res.redirect('/read');
		} 
	);
      });
});

app.get('/rate',function(req,res) {
	if (!req.session.authenticated) {
		res.render('login.ejs');
		//res.sendFile(__dirname + '/public/login.html');
	} else {
	var resID = req.query.id;
	res.render('rate.ejs',{res:resID});
	}
});

app.get('/gmap',function(req,res) {
	if (!req.session.authenticated) {
		res.render('login.ejs');
		//res.sendFile(__dirname + '/public/login.html');
	} else {
	var lat = req.query.lat;
	var lon = req.query.lon;
	var title = req.query.title;
	res.render("map.ejs",{lat:lat,lon:lon,title:title});
	}
});

function addRate(db,resID,resScore,rateOwner,callback) {
	db.collection('res').update(
	{"_id" : resID},
	{$push:
		{rate: {score :resScore,
			owner:rateOwner}
		}
	}, function(err,result) {
		if (err) {
			result = err;
			console.log("update: " + JSON.stringify(err));
		}
		callback(result);
	}
	);
}

//remove
app.get('/remove', function(req, res,callback) {
	if (!req.session.authenticated) {
		res.render('login.ejs');
		//res.sendFile(__dirname + '/public/login.html');
	}
	else{
		MongoClient.connect(mongourl,function(err,db) {
		assert.equal(null,err);
			deleteRes(db,req.query.id,req.session.username,
				function(result) {
					db.close();
					if(result.result.n ==1 )
						res.redirect('/');
					else
						res.render('error.ejs'); 
						//res.sendFile(__dirname + '/public/error.html');   
				}
			);
		});
	}
});

function deleteRes(db,target,owner,callback) {
	db.collection('res').remove({"_id": ObjectId(target),"owner" : owner}, 
		function(err,result) {
			if (err) {result = err;}
				callback(result);
		}
	);
}


app.listen(process.env.PORT || 8099, function() {
  console.log('waiting for requests...');
});