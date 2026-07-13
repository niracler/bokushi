/** Serialize JSON for an inline HTML script data block without allowing `</script>` breakout. */
export function serializeJsonForHtml(value: unknown): string {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
        throw new TypeError("Value cannot be serialized as JSON");
    }
    return serialized.replace(/</g, "\\u003c");
}
