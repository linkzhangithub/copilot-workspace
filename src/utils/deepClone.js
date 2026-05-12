/**
 * 深拷贝函数
 * @param {Array} arr - 需要深拷贝的数组
 * @returns {Array} - 深拷贝后的数组
 */
export const deepClone = (arr) => {
  return arr.map((item) => ({
    ...item,
    children: item.children ? deepClone(item.children) : [],
  }));
};
