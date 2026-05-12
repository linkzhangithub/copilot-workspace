import { ref } from "vue";

/**
 * 移动端检测 Composable
 * @returns {Object} - 包含 isMobile 和 checkIsMobile 的对象
 */
export const useDeviceDetect = () => {
  const isMobile = ref(false);

  const checkIsMobile = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isMobileUserAgent =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent,
      );
    isMobile.value = isTouchDevice && isMobileUserAgent;
  };

  return {
    isMobile,
    checkIsMobile,
  };
};
