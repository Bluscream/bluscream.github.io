const YAML = window.jsyaml;

const STATUS = {
    idle: "Waiting for YAML input",
    processing: "Processing…",
    success: "Output updated",
    error: "Something went wrong",
    overridesError: "Overrides not valid JSON",
};

const statusChip = document.querySelector('[data-role="status"]');

const yamlInputEditor = createEditor("yaml-input", { mode: "ace/mode/yaml" });
const yamlOutputEditor = createEditor("yaml-output", { mode: "ace/mode/yaml", readOnly: true });
const overridesEditor = createEditor("overrides-editor", { mode: "ace/mode/json" });

const resizeInput = enableAutoResize(yamlInputEditor, { minLines: 24, padding: 48 });
const resizeOutput = enableAutoResize(yamlOutputEditor, { minLines: 24, padding: 48 });
const resizeOverrides = enableAutoResize(overridesEditor, { minLines: 16, padding: 48 });

bootstrap();

async function bootstrap() {
    setStatus(STATUS.idle);

    await loadOverrides();

    yamlInputEditor.session.on("change", debounce(processYaml, 250));
    overridesEditor.session.on("change", debounce(processYaml, 250));
}

async function loadOverrides() {
    try {
        const response = await fetch("./defaults.jsonc");
        const text = await response.text();
        overridesEditor.setValue(text.trim(), -1);
        resizeOverrides();
    } catch (error) {
        console.error("Failed to load overrides", error);
        overridesEditor.setValue("[]", -1);
        resizeOverrides();
        setStatus("Could not load defaults.jsonc", true);
    }
}

function processYaml() {
    resizeInput();
    const rawInput = yamlInputEditor.getValue().trim();

    if (!rawInput) {
        yamlOutputEditor.setValue("", -1);
        setStatus(STATUS.idle);
        return;
    }

    setStatus(STATUS.processing);

    let data;
    try {
        data = YAML.load(rawInput);
    } catch (error) {
        console.error("YAML parse error", error);
        setStatus(`YAML error: ${error.message}`, true);
        return;
    }

    const overrides = getOverrides();
    if (!overrides) {
        return;
    }

    try {
        const processed = applyOverrides(structuredClone(data), overrides);
        const yaml = YAML.dump(processed, { lineWidth: 120, noRefs: true, sortKeys: false });
        yamlOutputEditor.setValue(yaml, -1);
        resizeOutput();
        setStatus(STATUS.success);
    } catch (error) {
        console.error("Processing error", error);
        setStatus(`${STATUS.error}: ${error.message}`, true);
    }
}

function getOverrides() {
    const raw = overridesEditor.getValue();
    if (!raw.trim()) {
        return [];
    }

    try {
        return JSON.parse(stripJsonComments(raw));
    } catch (error) {
        console.error("Overrides parse error", error);
        setStatus(`${STATUS.overridesError}: ${error.message}`, true);
        return null;
    }
}

function applyOverrides(data, overrides, scaleFactor = 1) {
    if (!Array.isArray(overrides) || overrides.length === 0) {
        return applyScaleOnly(data, scaleFactor);
    }

    traverse(data, (element) => {
        let matched = false;
        overrides.forEach((rule) => {
            if (!rule || typeof rule !== "object") return;
            if (!matchesFilters(element, rule.filters || {})) return;
            matched = true;
            mergeRule(element, rule);
        });
        if (matched) {
            applyScale(element, scaleFactor);
        }
    });

    return data;
}

function applyScaleOnly(data, scaleFactor = 1) {
    if (scaleFactor === 1 || Number.isNaN(scaleFactor) || scaleFactor <= 0) {
        return data;
    }
    traverse(data, (element) => applyScale(element, scaleFactor));
    return data;
}

function traverse(node, onElement) {
    if (!node || typeof node !== "object") {
        return;
    }

    if (Array.isArray(node)) {
        node.forEach((child) => traverse(child, onElement));
        return;
    }

    if (Array.isArray(node.elements)) {
        node.elements.forEach((element) => {
            if (element && typeof element === "object") {
                onElement(element);
                traverse(element, onElement);
            }
        });
    }

    Object.values(node).forEach((value) => traverse(value, onElement));
}

function matchesFilters(element, filters) {
    if (!filters || typeof filters !== "object") {
        return true;
    }

    return Object.entries(filters).every(([key, expected]) => {
        const actual = element?.[key];
        if (expected && typeof expected === "object" && !Array.isArray(expected)) {
            return matchesFilters(actual, expected);
        }
        return matchValue(actual, expected);
    });
}

function matchValue(actual, expected) {
    if (expected === undefined) {
        return true;
    }
    if (typeof expected === "string") {
        const regex = expected.match(/^\/(.*)\/(\w*)$/);
        if (regex) {
            try {
                const tester = new RegExp(regex[1], regex[2]);
                return tester.test(String(actual ?? ""));
            } catch {
                return false;
            }
        }
    }
    if (typeof expected === "object") {
        return JSON.stringify(actual) === JSON.stringify(expected);
    }
    return actual === expected;
}

function mergeRule(element, rule) {
    const payload = isPlainObject(rule?.overrides) ? rule.overrides : rule;
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (key === "filters" || key === "overrides") return;
        if (isPlainObject(value)) {
            element[key] = deepMerge(isPlainObject(element[key]) ? element[key] : {}, value);
        } else {
            element[key] = value;
        }
    });
}

function applyScale(element, scaleFactor = 1) {
    if (!element || typeof element !== "object") return;
    if (scaleFactor === 1 || Number.isNaN(scaleFactor) || scaleFactor <= 0) return;

    element.style = isPlainObject(element.style) ? element.style : {};
    const current = typeof element.style.scale === "string" ? parseFloat(element.style.scale) : Number(element.style.scale) || 100;
    const next = Number.isFinite(current) ? current * scaleFactor : 100 * scaleFactor;
    element.style.scale = `${Math.round(next * 100) / 100}%`;
}

function deepMerge(target, source) {
    const output = { ...target };
    Object.entries(source).forEach(([key, value]) => {
        if (isPlainObject(value)) {
            output[key] = deepMerge(isPlainObject(output[key]) ? output[key] : {}, value);
        } else {
            output[key] = value;
        }
    });
    return output;
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function stripJsonComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^\\:])\/\/.*$/gm, (match, prefix) => prefix);
}

function setStatus(message, isError = false) {
    if (!statusChip) return;
    statusChip.textContent = message;
    statusChip.dataset.state = isError ? "error" : "ok";
}

function createEditor(id, { mode, readOnly = false }) {
    const editor = ace.edit(id, {
        mode,
        theme: "ace/theme/one_dark",
        readOnly,
        useWorker: false,
    });
    editor.setOptions({
        fontSize: "14px",
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        showPrintMargin: false,
    });
    editor.session.setUseWrapMode(true);
    return editor;
}

function enableAutoResize(editor, { minLines = 12, padding = 32 } = {}) {
    const performResize = () => {
        const lineHeight = editor.renderer.lineHeight || 16;
        const lines = Math.max(editor.session.getScreenLength(), minLines);
        const height = lines * lineHeight + padding;
        editor.container.style.height = `${height}px`;
        editor.resize();
    };

    const scheduleResize = () => window.requestAnimationFrame(performResize);
    editor.session.on("change", scheduleResize);
    editor.session.on("changeFold", scheduleResize);
    window.addEventListener("resize", scheduleResize);
    scheduleResize();
    return performResize;
}

function debounce(fn, delay = 200) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
