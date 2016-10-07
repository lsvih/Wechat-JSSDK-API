var db = require('../db')
var express = require('express')
var router = express.Router()
var request = require('request')
var utils=require('../utils')
var config = require('./config')()
var crypto = require('crypto')
//?url=<url>
router.get('/wx', function(req, res) {
let signUrl = req.query.url
  getSignature(signUrl,function(err,signInfo){
  	if(err){
  		if(err == 'Created database'){
  			getSignature(signUrl,function(err,signInfo){
  				res.send(err||signInfo)
  			})
  		}else{
  			res.send(err)
  		}
  	}else{
  		res.send(signInfo)
  	}
  })
});
module.exports = router;
function getAccessToken(config,cb){
     let wxUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`
     console.log(`Getting accessToken`)
     request.get(wxUrl , function(err,res,data){
     	if(err){
     		cb('There is an error when getting access_token',err)
     	}
     	else{
     		try{
     			cb(null, JSON.parse(data).access_token)
     		}catch(e){
     			cb('There is an error when getting access_token',e)
     		}
     	}
     })
}
function getJsApiTicket(accessToken,cb){
    let wxUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`
    console.log(`Getting ticket`)
    request.get(wxUrl , function(err,res,data){
        if(err){
            cb('There is an error when getting api ticket',err)
        }
        else{
            try{
                cb(null,JSON.parse(data).ticket)
            }catch(e){
                cb('There is an error when getting api ticket',e)
            }
        }
    })
}
function getNewSign(config,url,cb){
    var timestamp = getTimesTamp()
    var noncestr = getNonceStr()
    var signStr = 'jsapi_ticket=' + db.wx.ticket + '&noncestr=' + noncestr + '&timestamp=' + timestamp + '&url=' + url
    console.log(signStr)
    var signature = crypto.createHash('sha1').update(signStr).digest('hex');
    // console.log(`New sign is ${signature}`)
    cb({
    	appId: config.appId,
        timestamp: timestamp,
        nonceStr: noncestr,
        signature: signature
    })
}
function getSignature(url,cb){
    if(!db){
        cb('Database error',null)
    }else{
        try{
            if(getTimesTamp() - db.wx.timestamp >= 5000){
                console.log(`access_token is expired`)
                console.log(`Getting an new access_token...`)
                getAccessToken(config,function(err,accessToken){
                if(err){
                    cb(err,null)
                }else{
                    console.log('Get a new access_token')
                    db.wx.access_token = accessToken
                    getJsApiTicket(accessToken,function(err,ticket){
                        if(err){
                            cb(err,null)
                        }else{
                            console.log('Get a new ticket')
                            db.wx.ticket = ticket
                            db.wx.timestamp = getTimesTamp()
                            getNewSign(config,url,function(signInfo){
                                cb(null,signInfo)
                            })
                        }
                    })
                }
                })
            }else{
                getNewSign(config,url,function(signInfo){
                    cb(null,signInfo)
                })
            }
        }catch(e){
            if(/.*(of undefined).*/.test(e)){
                db.wx = {
                    signs:[],
                    access_token: null,
                    ticket:null,
                    timestamp: '0'
                }
                cb('Created database',null)
            }else{
                cb('Database error',null)
            }
        }
    }
}
function getTimesTamp() {
    return parseInt(new Date().getTime() / 1000) + '';
}
function getNonceStr() {
    return Math.random().toString(36).substr(2, 15);
}