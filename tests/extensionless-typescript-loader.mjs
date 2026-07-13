export function resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
        return {
            shortCircuit: true,
            url: new URL("./cloudflare-workers-stub.mjs", import.meta.url).href,
        };
    }

    const tryTypeScriptExtension = (error) => {
        const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
        const hasExtension = /\.[^/]+$/.test(specifier);
        if (error?.code !== "ERR_MODULE_NOT_FOUND" || !isRelative || hasExtension) {
            throw error;
        }
        return nextResolve(`${specifier}.ts`, context);
    };

    try {
        const resolved = nextResolve(specifier, context);
        return typeof resolved?.catch === "function"
            ? resolved.catch(tryTypeScriptExtension)
            : resolved;
    } catch (error) {
        return tryTypeScriptExtension(error);
    }
}

export function load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    const replaceAstroEnv = (result) => {
        if (!url.endsWith("/src/consts.ts")) return result;
        return {
            ...result,
            source: result.source.toString().replaceAll("import.meta.env.", "({})."),
        };
    };

    return typeof loaded?.then === "function"
        ? loaded.then(replaceAstroEnv)
        : replaceAstroEnv(loaded);
}
