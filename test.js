/*jslint node, unordered, fart */
/*property
    deepEqual, end, equal, evidence, fallback, fill, isArray, length, message,
    myFlag, notEqual, ok, only, parallel, plan, prependListener, race,
    removeListener, sequence, teardown, throws
*/

import process from "node:process";

import test from "tape";
import pronto from "./prontissimo.js";

function hasThrown(event, message, t) {
    const listener = function (err) {
        if (
            is_my_error(err)
            && (
                err?.evidence?.message === `${message}`
                || err?.message === `${message}`
            )
        ) {
            t.ok(true);
            return t.end();
        }
        t.ok(false);
    };
    process.prependListener(event, listener);

    return function cancel() {
        process.removeListener(event, listener);
    };
}

function my_error(msg) {
    const err = new Error(msg);
    err.myFlag = true;

    return err;
}
function is_my_error(err) {
    return err?.myFlag || err?.evidence?.myFlag;
}

test("empty parallel requestor array", function (t) {
    t.plan(1);
    pronto.parallel([])(function (value, ignore) {
        t.deepEqual(value, [], "an empty array is passed as result");
        return;
    }, true);
});

test("empty sequence requestor array", function (t) {
    t.plan(1);
    pronto.sequence([])(function (value, ignore) {
        t.equal(value, true, "value is passed as result");
        return;
    }, true);
});

test("array length must be preserved", function (t) {
    const len = 1000;
    pronto.parallel(
        new Array(len).fill((cb, ignore) => cb(true))
    )(function (value, reason) {
        t.notEqual(value, undefined, `no errors: ${reason}`);
        t.equal(value?.length, len, "same length as input");
        t.end();
    }, 1);
});

test(
    "callback must be invoked just one time for sync requestor",
    function (t) {
        const error_message = "Booom!";

        const cancel = hasThrown(
            "uncaughtException",
            error_message,
            t
        );
        t.teardown(cancel);

        let called = 0;
        pronto.sequence([
            function (cb, v) {
                return setTimeout(() => cb(v), 10);
            }
        ])(function (value, ignore) {
            called += 1;
            t.ok(called < 2, "callback invoked two times");
            if (called > 1) {
                t.end();
            }
            if (value === undefined) {
                return;
            }
            if (called === 1) {
                throw my_error(error_message);
            }
        }, 1);
    }
);

test("must throw", function (t) {
    let called = 0;
    const error_message = "Booom!";
    const cancel = hasThrown(
        "uncaughtException",
        error_message,
        t
    );
    t.teardown(cancel);

    pronto.sequence([pronto.sequence([
        function (cb, v) {
            return setTimeout(() => cb(v), 10);
        }
    ])])(function (value, ignore) {
        called += 1;
        t.ok(called < 2, "callback invoked two times");
        if (called > 1) {
            t.end();
        }
        if (value === undefined) {
            return;
        }
        if (called === 1) {
            throw my_error(error_message);
        }
    }, 1);
});

test("sequence", function (t) {
    const len = 100;
    pronto.sequence(
        new Array(len).fill((cb, v) => cb(v + 1))
    )(
        function (value, ignore) {
            t.equal(value, len);
            t.end();
        },
        0
    );
});

test("parallel", function (t) {
    const len = 100;
    pronto.parallel(
        new Array(len).fill((cb, v) => cb(v + 1))
    )(
        function (value, ignore) {
            t.ok(Array.isArray(value));
            t.equal(value.length, len);
            t.deepEqual(value, new Array(len).fill(1));
            t.end();
        },
        0
    );
});

test("race", function (t) {
    const delay = (d) => (c) => (cb, v) => setTimeout(cb, d, v + c);
    pronto.race([
        delay(10)(1),
        delay(20)(2),
        delay(30)(3),
        delay(40)(4)
    ])(
        function (value, ignore) {
            t.equal(value, 1);
            t.end();
        },
        0
    );
});

test("fallback", function (t) {
    pronto.fallback([
        (cb, v) => cb(undefined, v),
        (cb, v) => cb(undefined, v),
        (cb, v) => cb(3, v)
    ])(
        function (value, ignore) {
            t.equal(value, 3);
            t.end();
        },
        0
    );
});
