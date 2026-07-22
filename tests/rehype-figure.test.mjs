import assert from "node:assert/strict";
import test from "node:test";
import { rehypeFigure } from "../rehype-figure.mjs";

function root(children) {
    return { type: "root", children };
}

function element(tagName, properties = {}, children = []) {
    return { type: "element", tagName, properties, children };
}

function image(alt = "") {
    return element("img", { src: "/image.png", alt });
}

test("paragraphs without images remain unchanged", () => {
    const paragraph = element("p", {}, [{ type: "text", value: "Text" }]);
    const tree = root([paragraph]);

    rehypeFigure()(tree);

    assert.equal(tree.children[0], paragraph);
});

test("a single image becomes a rehype figure", () => {
    const tree = root([element("p", {}, [image()])]);

    rehypeFigure()(tree);

    assert.equal(tree.children[0].tagName, "figure");
    assert.deepEqual(tree.children[0].properties.className, ["rehype-figure"]);
    assert.equal(tree.children[0].children[0].tagName, "img");
});

test("non-empty alt text becomes a figcaption", () => {
    const tree = root([element("p", {}, [image("A caption")])]);

    rehypeFigure()(tree);

    assert.deepEqual(tree.children[0].children[1], {
        type: "element",
        tagName: "figcaption",
        properties: {},
        children: [{ type: "text", value: "A caption" }],
    });
});

test("multiple images become a rehype figure container", () => {
    const tree = root([element("p", {}, [image("First"), image("Second")])]);

    rehypeFigure()(tree);

    assert.equal(tree.children[0].tagName, "div");
    assert.deepEqual(tree.children[0].properties.className, ["rehype-figure-container"]);
    assert.deepEqual(
        tree.children[0].children.map((child) => child.tagName),
        ["figure", "figure"],
    );
});
