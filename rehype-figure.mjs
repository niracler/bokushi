const FIGURE_CLASS_NAME = "rehype-figure";

function createElement(tagName, properties = {}, children = []) {
    return {
        type: "element",
        tagName,
        properties,
        children,
    };
}

function createFigure(image) {
    const alt = typeof image.properties?.alt === "string" ? image.properties.alt : "";
    const children = [image];

    if (alt.trim().length > 0) {
        children.push(createElement("figcaption", {}, [{ type: "text", value: alt }]));
    }

    return createElement("figure", { className: [FIGURE_CLASS_NAME] }, children);
}

function transformChildren(parent) {
    if (!Array.isArray(parent.children)) return;

    parent.children = parent.children.map((node) => {
        if (node?.type === "element" && node.tagName === "p") {
            const images = node.children
                .filter((child) => child?.type === "element" && child.tagName === "img")
                .map(createFigure);

            if (images.length === 1) return images[0];
            if (images.length > 1) {
                return createElement(
                    "div",
                    { className: [`${FIGURE_CLASS_NAME}-container`] },
                    images,
                );
            }
        }

        if (node?.type === "element") transformChildren(node);
        return node;
    });
}

export function rehypeFigure() {
    return transformChildren;
}
