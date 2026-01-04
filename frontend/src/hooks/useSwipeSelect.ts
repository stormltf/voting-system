'use client';

import { useRef, useCallback } from 'react';

interface UseSwipeSelectOptions {
  onSelect: (id: number, selected: boolean) => void;
  enabled: boolean;
}

/**
 * 滑动多选 Hook
 * 支持在移动端滑动手指时连续选中多个元素
 */
export function useSwipeSelect({ onSelect, enabled }: UseSwipeSelectOptions) {
  const isSwipingRef = useRef(false);
  const selectModeRef = useRef<boolean>(true); // true = 选中模式, false = 取消选中模式
  const selectedDuringSwipeRef = useRef<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取触摸位置下的元素 ID
  const getElementIdAtPoint = useCallback((x: number, y: number): number | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    // 向上查找带有 data-selectable-id 属性的元素
    const selectableElement = element.closest('[data-selectable-id]');
    if (!selectableElement) return null;

    const id = selectableElement.getAttribute('data-selectable-id');
    return id ? parseInt(id, 10) : null;
  }, []);

  // 处理触摸开始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const id = getElementIdAtPoint(touch.clientX, touch.clientY);

    if (id !== null) {
      isSwipingRef.current = true;
      selectedDuringSwipeRef.current = new Set([id]);

      // 判断当前元素是否已选中，决定是选中模式还是取消选中模式
      const element = document.querySelector(`[data-selectable-id="${id}"]`);
      const isCurrentlySelected = element?.getAttribute('data-selected') === 'true';
      selectModeRef.current = !isCurrentlySelected;

      onSelect(id, selectModeRef.current);
    }
  }, [enabled, getElementIdAtPoint, onSelect]);

  // 处理触摸移动
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isSwipingRef.current) return;

    const touch = e.touches[0];
    const id = getElementIdAtPoint(touch.clientX, touch.clientY);

    if (id !== null && !selectedDuringSwipeRef.current.has(id)) {
      selectedDuringSwipeRef.current.add(id);
      onSelect(id, selectModeRef.current);
    }
  }, [enabled, getElementIdAtPoint, onSelect]);

  // 处理触摸结束
  const handleTouchEnd = useCallback(() => {
    isSwipingRef.current = false;
    selectedDuringSwipeRef.current = new Set();
  }, []);

  // 鼠标事件支持（用于桌面端测试）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;

    const id = getElementIdAtPoint(e.clientX, e.clientY);

    if (id !== null) {
      isSwipingRef.current = true;
      selectedDuringSwipeRef.current = new Set([id]);

      const element = document.querySelector(`[data-selectable-id="${id}"]`);
      const isCurrentlySelected = element?.getAttribute('data-selected') === 'true';
      selectModeRef.current = !isCurrentlySelected;

      onSelect(id, selectModeRef.current);
    }
  }, [enabled, getElementIdAtPoint, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!enabled || !isSwipingRef.current) return;

    const id = getElementIdAtPoint(e.clientX, e.clientY);

    if (id !== null && !selectedDuringSwipeRef.current.has(id)) {
      selectedDuringSwipeRef.current.add(id);
      onSelect(id, selectModeRef.current);
    }
  }, [enabled, getElementIdAtPoint, onSelect]);

  const handleMouseUp = useCallback(() => {
    isSwipingRef.current = false;
    selectedDuringSwipeRef.current = new Set();
  }, []);

  const handleMouseLeave = useCallback(() => {
    isSwipingRef.current = false;
    selectedDuringSwipeRef.current = new Set();
  }, []);

  return {
    containerRef,
    containerProps: {
      ref: containerRef,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
  };
}
