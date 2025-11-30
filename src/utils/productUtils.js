// src/utils/productUtils.js

/**
 * Finds a product in a list by its SKU.
 * @param {Array<Object>} products - The list of product objects.
 * @param {string} sku - The SKU to search for.
 * @returns {Object|undefined} The found product or undefined.
 */
export const getProductBySku = (products, sku) => products.find(p => p.sku === sku);

/**
 * Generates a display name for a product.
 * @param {Object} product - The product object.
 * @returns {string} The formatted display name.
 */
export const getProductDisplayName = (product) => product ? `${product.sku} - ${product.model || 'N/A'}` : 'Unknown Product';
