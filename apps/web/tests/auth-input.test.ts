import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCode, validateAuth } from "../src/lib/auth-input.ts";

test("legacy passwords remain valid login input while new passwords require eight characters", () => {
    assert.deepEqual(
        validateAuth("login", {
            email: " old@example.com ",
            password: "short",
        }),
        {},
    );
    assert.equal(
        validateAuth("register", {
            email: "new@example.com",
            name: "New",
            password: "short",
            password_confirmation: "short",
        }).password,
        "Use at least 8 characters.",
    );
});
test("registration and reset require matching confirmation without trimming passwords", () => {
    for (const mode of ["register", "reset"] as const) {
        const values = {
            email: "new@example.com",
            name: "New",
            password: " a long password ",
            password_confirmation: "a long password",
        };
        assert.equal(
            validateAuth(mode, values).password_confirmation,
            "Passwords do not match.",
        );
        assert.deepEqual(
            validateAuth(mode, {
                ...values,
                password_confirmation: values.password,
            }),
            {},
        );
    }
    assert.ok(
        validateAuth("register", { email: "bad", name: " ", password: "" })
            .name,
    );
});
test("one-time codes preserve leading zeroes, accept spaces and reject non-ASCII digits", () => {
    assert.equal(normalizeCode("012 345"), "012345");
    assert.deepEqual(validateAuth("two-factor", { code: "012 345" }), {});
    assert.ok(validateAuth("two-factor", { code: "１２３４５６" }).code);
    assert.ok(
        validateAuth("recover-code", { code: "123456", email: "bad" }).email,
    );
});

 test("new account and reset passwords accept eight characters and reject seven", () => {
    for (const mode of ["register", "reset"] as const) {
        for (const password of ["1234567", "12345678"]) {
            const errors = validateAuth(mode, { email: "new@example.com", name: "New", password, password_confirmation: password });
            assert.equal(errors.password, password.length < 8 ? "Use at least 8 characters." : undefined);
        }
    }
});
