/*jslint node, unordered, fart */
/*property
deepEqual, equal, evidence, fallback, fill, length, listeners, log, message,
myFlag, ok, on, only, parallel, prependListener, race, removeAllListeners,
removeListener, skip, sequence, throws
*/

import {before, test} from "node:test";
import process from "node:process";
import assert from "node:assert/strict";
import pronto from "./pronto.js";
// import parseq from "../parseq/parseq.js"; //for comparison

const empty_callback = (value, reason) => console.log(value, reason);

function my_error(msg) {
    const err = new Error(msg);
    err.myFlag = true;

    return err;
}

function hasThrown(event, message, done) {
    const id = setTimeout(function () {
        return done(new Error("Callback must throw"));
    }, 1000);
    const listener = function (err) {
        if (
            err?.evidence?.message === `${message}`
            || err?.message === `${message}`
        ) {
            process.removeListener(event, listener);
            clearTimeout(id);
            return done();
        }
    };
    process.prependListener(event, listener);
}

before(function () {
    const defaultExceptionListener = process.listeners("uncaughtException")[0];
    process.removeAllListeners("uncaughtException");
    process.on("uncaughtException", function (err) {
        if (!err.myFlag && !err?.evidence?.myFlag) {
            defaultExceptionListener(err);
        }
    });

    const defaultRejectionListener = process.listeners("unhandledRejection")[0];
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", function (err) {
        if (!err.myFlag && !err?.evidence?.myFlag) {
            defaultRejectionListener(err);
        }
    });
});

test("empty parallel requestor array", function (ignore, done) {
    pronto.parallel([])(function (value, ignore) {
        assert.deepEqual(value, [], "an empty array is passed as result");
        return done();
    }, true);
});

test("empty sequence requestor array", function (ignore, done) {
    pronto.sequence([])(function (value, ignore) {
        assert.equal(value, true, "value is passed as result");
        return done();
    }, true);
});

test("empty fallback requestor array", function () {
    assert.throws(
        () => pronto.fallback([])(empty_callback, true)
    );
});

test("empty race requestor array", function () {
    assert.throws(
        () => pronto.race([])(empty_callback)
    );
});

test(
    "callback must be invoked just one time for sync requestor",
    function (ignore, done) {
        hasThrown(
            "uncaughtException",
            "Booom!",
            done
        );

        let called = 0;
        pronto.sequence([
            function (cb, v) {
                return cb(v);
            }
        ])(function (value, ignore) {
            called += 1;
            assert.ok(called < 2, "callback invoked two times");
            if (value === undefined) {
                return;
            }
            if (called === 1) {
                throw my_error("Booom!");
            }
        }, 1);
    }
);

test("must throw", function (ignore, done) {
    hasThrown(
        "uncaughtException",
        "Booom!",
        done
    );

    let called = 0;
    pronto.sequence([pronto.sequence([
        function (cb, v) {
            return cb(v);
        }
    ])])(function (value, ignore) {
        called += 1;
        assert.ok(called < 2);
        if (value === undefined) {
            return;
        }
        if (called === 1) {
            throw my_error("Booom!");
        }
    }, 1);
});

test("array length must be preserved", function (ignore, done) {
    const len = 5000;
    pronto.parallel(
        new Array(len).fill((cb, ignore) => cb(true))
    )(function (value, ignore) {
        assert.equal(value?.length, len);
        return done();
    }, 1);
});
