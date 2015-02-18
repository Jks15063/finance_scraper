var debug      = require('debug')('CI')
var GitHubApi  = require('github');
var express    = require('express');
var bodyParser = require('body-parser');
var app        = express();

var github = new GitHubApi({
    version: "3.0.0"
});

github.authenticate({
    type: "basic",
    username: 'Jks15063',
    password: 'R7t5ngB6'
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/', function (req, res) {
    var pr     = req.body.pull_request || null;
    var action = req.body.action;
    var repo;
    var prSha;

    if(pr) {
        debug('---------------------------------------------');
        debug('PR event')
        repo = pr.base.repo.name;
        prSha = req.body.pull_request.head.sha;
        github.statuses.create({
            user: 'Jks15063',
            repo: repo,
            sha: prSha,
            state: 'pending'
        }, function(err, status) {
            if(err) {
                debug('ERR:' + err);
            } else {
                var testPass = true;
                github.statuses.create({
                    user: 'Jks15063',
                    repo: repo,
                    sha: prSha,
                    state: (testPass) ? 'success' : 'failure'
                }, function(err, status) {
                    if(err) {
                        debug('ERR:', err);
                    } else {
                        debug('FINAL STATUS:', status);
                    }
                })
            }
            res.send();
        })
    } else {
        debug('Non-PR event')
        res.end()
    }
});

var server = app.listen(3000, '127.0.0.1', function () {
    var host = server.address().address;
    var port = server.address().port;
    debug('Example app listening at http://%s:%s', host, port);
});
