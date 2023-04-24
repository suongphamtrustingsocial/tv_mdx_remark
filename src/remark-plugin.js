const debug = require("debug")("dwolla-mdx-remark");
const glob = require("glob");
const matter = require("gray-matter");
const path = require("path");

const DEFAULT_LAYOUTS_DIR = "layouts";
const DEFAULT_LAYOUTS_FILE = "index";

function fileExists(path) {
    debug("Checking if file exists at following path: ", path);
    return new Promise((resolve, reject) => {
        glob(path, null, (err, files) => {
            if (err) return reject(err);
            debug("Glob returned with if file exists? ", (files.length !== 0));
            return resolve(files.length !== 0);
        });
    });
}

function normalizeToUnixPath(str) {
    return str.replace(/\\/g, "/");
}

/**
 * This MDX plugin performs the following functions:
 *  1. Extracts frontmatter from MDXAST, stringifies, and injects it back as `frontMatter` variable
 *  2. Determines if a layout should be used and if so, injects the layout
 *
 * For more information regarding MDXAST, please see here:
 * https://github.com/mdx-js/specification#mdxast
 */
module.exports = () => async (tree, file) => {
    // Extract the resource path for this specific file for injection. Used because of legacy
    // dependency on `next-mdx-enhanced`: https://github.com/hashicorp/next-mdx-enhanced/blob/main/index.js#L118-L120
    const resourcePath = file.history[0]
        .replace(path.join(file.cwd, "pages"), "")
        .substring(1);
    debug("Processing file: ", resourcePath);

    // Since this package is pure ESM, it must be imported asynchronously within the
    // function and cannot be imported at the top of the script file.
    const {default: stringifyObject} = await import("stringify-object");
    let {data: frontMatter} = matter(file.contents);
    frontMatter = {...frontMatter, __resourcePath: resourcePath};
    debug("Extracted following frontmatter: ", frontMatter);

    // Export the frontmatter variable to the AST
    tree.children.push({
        type: "export",
        value: `export const frontMatter = ${stringifyObject(frontMatter)}`,
    });

    // Remove the frontmatter node from the AST, because it has already
    // been processed and exported above.
    if (tree.children[0].type === "thematicBreak") {
        const firstHeadingIndex = tree.children.findIndex(
            (t) => t.type === "heading"
        );

        if (firstHeadingIndex !== -1) {
            tree.children.splice(0, firstHeadingIndex + 1);
        }
    }

    // On some pages (e.g., the home page), don't export any layout, since the
    // MDX file already includes a default export by itself.
    if (!frontMatter.noDefaultLayout) {
        // Determine if the layout that should be used, if any
        const layoutPath = path.resolve(
            file.cwd,
            DEFAULT_LAYOUTS_DIR,
            frontMatter.layout || DEFAULT_LAYOUTS_FILE
        );

        // Confirm that the layout exists - if it doesn't, don't inject
        if (await fileExists(`${layoutPath}.*(js|jsx|ts|tsx)`)) {
            // Import our layout in the AST
            tree.children.push({
                type: "import",
                value: `import Layout from "${normalizeToUnixPath(layoutPath)}"`,
            });

            // Add our default export for the layout we're using.
            // This behavior should mimic https://nextjs.org/docs/advanced-features/using-mdx#layouts
            tree.children.push({
                type: "export",
                default: true,
                value: `export default Layout`,
            });
        }
    }
};
