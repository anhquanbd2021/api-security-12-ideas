export class ExternalError extends Error {
    kind;
    constructor(kind) {
        super(kind);
        this.kind = kind;
    }
}
