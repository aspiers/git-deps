import os
import subprocess

from gitutils import GitUtils
from git_deps.detector import DependencyDetector
from git_deps.errors import InvalidCommitish
from git_deps.listener.json import JSONDependencyListener
from git_deps.utils import abort


def serve(options):
    try:
        import flask
        from flask import Flask, send_file, safe_join
        from flask.json import jsonify
    except ImportError:
        abort("Cannot find flask module which is required for webserver mode.")

    webserver = Flask('git-deps')
    here = os.path.dirname(os.path.realpath(__file__))
    root = os.path.join(here, 'html')
    webserver.root_path = root

    ##########################################################
    # Static content

    @webserver.route('/')
    def main_page():
        return send_file('git-deps.html')

    @webserver.route('/tip-template.html')
    def tip_template():
        return send_file('tip-template.html')

    @webserver.route('/test.json')
    def data():
        return send_file('test.json')

    def make_subdir_handler(subdir):
        def subdir_handler(filename):
            path = safe_join(root, subdir)
            path = safe_join(path, filename)
            if os.path.exists(path):
                return send_file(path)
            else:
                flask.abort(404)
        return subdir_handler

    for subdir in ('node_modules', 'css', 'js'):
        fn = make_subdir_handler(subdir)
        route = '/%s/<path:filename>' % subdir
        webserver.add_url_rule(route, subdir + '_handler', fn)

    ##########################################################
    # Dynamic content

    def json_error(status_code, error_class, message, **extra):
        json = {
            'status': status_code,
            'error_class': error_class,
            'message': message,
        }
        json.update(extra)
        response = jsonify(json)
        response.status_code = status_code
        return response

    @webserver.route('/options')
    def send_options():
        client_options = options.__dict__
        client_options['repo_path'] = os.getcwd()
        return jsonify(client_options)

    @webserver.route('/deps.json/<revspec>')
    def deps(revspec):
        detector = DependencyDetector(options)
        listener = JSONDependencyListener(options)
        detector.add_listener(listener)

        if '..' in revspec:
            try:
                revisions = GitUtils.rev_list(revspec)
            except subprocess.CalledProcessError as e:
                return json_err(
                    422, 'Invalid revision range',
                    "Could not resolve revision range '%s'" % revspec,
                    revspec=revspec)
        else:
            revisions = [revspec]

        for rev in revisions:
            try:
                commit = detector.get_commit(rev)
            except InvalidCommitish as e:
                return json_error(
                    422, 'Invalid revision',
                    "Could not resolve revision '%s'" % rev,
                    rev=rev)

            detector.find_dependencies(rev)

        tip_commit = detector.get_commit(revisions[0])
        tip_sha1 = tip_commit.hex

        json = listener.json()
        json['query'] = {
            'revspec': revspec,
            'revisions': revisions,
            'tip_sha1': tip_sha1,
            'tip_abbrev': GitUtils.abbreviate_sha1(tip_sha1),
        }
        return jsonify(json)

    # We don't want to see double-decker warnings, so check
    # WERKZEUG_RUN_MAIN which is only set for the first startup, not
    # on app reloads.
    if options.debug and not os.getenv('WERKZEUG_RUN_MAIN'):
        print("!! WARNING!  Debug mode enabled, so webserver is completely "
              "insecure!")
        print("!! Arbitrary code can be executed from browser!")
        print()
    webserver.run(port=options.port, debug=options.debug, host=options.bindaddr)
