var express = require('express');
var router = express.Router();
var passport = require('passport');
var async = require('async');
var csrf = require('csurf');

var Product = require('../models/product');
var Order = require('../models/order');
var Cart = require('../models/cart');
var User = require('../models/user');
var ShippingAddress = require('../models/shippingAddress');

var csrfProtection = csrf();
router.use(csrfProtection);

router.get('/register', isNotLoggedIn, function(req, res, next) {
    var messages = req.flash('error');
    res.render('user/register', {csrfToken: req.csrfToken(), messages: messages, hasErrors: messages.length > 0});
});

router.post('/register', isNotLoggedIn, passport.authenticate('local.register', {
    failureRedirect: '/user/register',
    failureFlash: true
}), handleLoginSuccess);

router.get('/login', isNotLoggedIn, function(req, res, next) {
    var messages = req.flash('error');
    res.render('user/login', {csrfToken: req.csrfToken(), messages: messages, hasErrors: messages.length > 0});
});

router.post('/login', isNotLoggedIn, passport.authenticate('local.login', {
    failureRedirect: '/user/login',
    failureFlash: true
}), handleLoginSuccess);

router.get('/logout', isLoggedIn, function(req, res, next) {
    req.logout();
    res.redirect('/');
});

router.get('/profile', isLoggedIn, function(req, res, next) {
    ShippingAddress.findOne({user: req.user}, function(err, shipping){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('/checkout');
        }

        res.render('user/profile', {shipping: shipping});
    });
});

router.get('/productsForSale', isLoggedIn, function(req, res, next) {
    Product.find({seller: req.user}).sort({ createdAt: -1, _id: -1}).exec(function(err, products){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('/');
        }

        return res.render('user/productsForSale', {products: products});

    });
});

router.get('/orders', isLoggedIn, function(req, res, next) {
    Order.find({user: req.user}).sort({ createdAt: -1, _id: -1}).exec(function(err, orders){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        if(orders.length === 0){
            return res.render('user/orders', {orders: null});
        }

        var cart;
        var itemsProcessed = 0;
        orders.forEach(function(order){
            cart = new Cart(order.cart);
            order.items = cart.generateArray();

            var date = new Date(order.createdAt);
            order.datetime = date.toLocaleTimeString("en-US", {year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
            }); //order.createdAt;

            itemsProcessed++;

            if(itemsProcessed === orders.length){
                return res.render('user/orders', {orders: orders});
            }
        });
    });
});

router.get('/soldProducts', isLoggedIn, function(req, res, next) {
    Order.find({sellers: req.user}).populate(['user', 'shippingAddress']).sort({ createdAt: -1, _id: -1}).exec(function(err, orders){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        if(orders.length === 0){
            return res.render('user/soldProducts', {orders: null});
        }

        var cart;
        var itemsProcessed = 0;
        orders.forEach(function(order){
            cart = new Cart(order.cart);
            var arr = cart.groupBySeller();
            for(var i = 0; i < arr.length; i++){
                if(req.user.equals(arr[i][0].item.seller)){
                    order.items = arr[i];
                    break;
                }
            }

            var date = new Date(order.createdAt);
            order.datetime = date.toLocaleTimeString("en-US", {year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
            }); //order.createdAt;

            itemsProcessed++;
            if(itemsProcessed === orders.length){
                return res.render('user/soldProducts', {orders: orders, numOrders: orders.length});
            }
        });
    });
});

module.exports = router;

function handleLoginSuccess(req, res, next){
    var oldUrl = req.session.oldUrl;
    if(oldUrl){
        req.session.oldUrl = null;
        res.redirect(oldUrl);
    }else{
        res.redirect('/user/profile');
    }
}

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect('/');
}

function isNotLoggedIn(req, res, next){
    if(!req.isAuthenticated()){
        return next();
    }
    res.redirect('/');
}
