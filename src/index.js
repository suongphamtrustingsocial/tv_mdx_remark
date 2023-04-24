const debug = require("debug")("dwolla-mdx-remark");
const remarkPlugin = require("./remark-plugin");

module.exports = (pluginOptions = {}) => (nextConfig = {}) => ({
    ...nextConfig,
    pageExtensions: Array.from(
        new Set([...(nextConfig.pageExtensions || []), "md", "mdx"])
    ),
    webpack(config, options) {
        const expandedRemarkPlugins = [...(pluginOptions?.options?.remarkPlugins || []), remarkPlugin];
        const expandedOptions = {...pluginOptions?.options, remarkPlugins: expandedRemarkPlugins};
        debug("Using Expanded Options: ", expandedOptions);

        config.module.rules.push({
            test: pluginOptions.extension || /\.mdx?$/,
            use: [
                options.defaultLoaders.babel,
                {
                    loader: require.resolve("@mdx-js/loader"),
                    options: expandedOptions
                }
            ]
        });

        if (typeof nextConfig.webpack === "function") {
            return nextConfig.webpack(config, options);
        }
        return config;
    }
});