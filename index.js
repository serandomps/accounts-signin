var dust = require('dust')();
var serand = require('serand');
var utils = require('utils');

dust.loadSource(dust.compile(require('./template'), 'accounts-signin'));

module.exports = function (sandbox, fn, options) {
    dust.render('accounts-signin', {}, function (err, out) {
        if (err) {
            return;
        }
        sandbox.append(out);
        sandbox.on('click', '.accounts-signin .signin', function (e) {
            var el = $('.accounts-signin', sandbox);
            var username = $('.username', el).val();
            var password = $('.password', el).val();
            authenticate(username, password, options);
            return false;
        });
        sandbox.on('click', '.accounts-signin .facebook', function (e) {
            options.type = 'facebook';
            serand.emit('user', 'oauth', options);
            return false;
        });
        fn(false, function () {
            $('.accounts-signin', sandbox).remove();
        });
    });
};

var authenticate = function (username, password, options) {
    $.ajax({
        method: 'POST',
        url: utils.resolve('accounts://apis/v/tokens'),
        data: {
            client_id: options.clientId,
            grant_type: 'password',
            username: username,
            password: password
        },
        contentType: 'application/x-www-form-urlencoded',
        dataType: 'json',
        success: function (token) {
            var user = {
                tid: token.id,
                username: username,
                access: token.access_token,
                refresh: token.refresh_token,
                expires: token.expires_in
            };
            serand.emit('token', 'info', user.tid, user.access, function (err, token) {
                if (err) {
                    serand.emit('user', 'login error');
                    return;
                }
                user.has = token.has;
                serand.emit('user', 'logged in', user, options);
            });
        },
        error: function () {
            serand.emit('user', 'login error');
        }
    });
};
