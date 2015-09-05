var dust = require('dust')();
var serand = require('serand');

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
            serand.emit('user', 'authenticate', username, password);
            return false;
        });
        fn(false, function () {
            sandbox.remove('.accounts-signin');
        });
    });
};
