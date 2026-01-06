import { renderHook, act } from '@testing-library/react';
import { useSwipeSelect } from '../useSwipeSelect';

describe('useSwipeSelect', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div data-selectable-id="1" data-selected="false"></div>
      <div data-selectable-id="2" data-selected="true"></div>
      <div data-selectable-id="3" data-selected="false"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('应该返回 containerProps', () => {
    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    expect(result.current.containerProps).toBeDefined();
    expect(result.current.containerProps.onTouchStart).toBeDefined();
    expect(result.current.containerProps.onTouchMove).toBeDefined();
    expect(result.current.containerProps.onTouchEnd).toBeDefined();
    expect(result.current.containerProps.onMouseDown).toBeDefined();
    expect(result.current.containerProps.onMouseMove).toBeDefined();
    expect(result.current.containerProps.onMouseUp).toBeDefined();
    expect(result.current.containerProps.onMouseLeave).toBeDefined();
  });

  it('禁用时不应该响应触摸事件', () => {
    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: false }));

    const touchEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchStart(touchEvent);
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('禁用时不应该响应鼠标事件', () => {
    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: false }));

    const mouseEvent = {
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.containerProps.onMouseDown(mouseEvent);
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('触摸开始时应该选中元素', () => {
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockReturnValue(
      document.querySelector('[data-selectable-id="1"]')
    );

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const touchEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchStart(touchEvent);
    });

    expect(mockOnSelect).toHaveBeenCalledWith(1, true);
    document.elementFromPoint = originalElementFromPoint;
  });

  it('触摸已选中元素时应该取消选中', () => {
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockReturnValue(
      document.querySelector('[data-selectable-id="2"]')
    );

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const touchEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchStart(touchEvent);
    });

    expect(mockOnSelect).toHaveBeenCalledWith(2, false);
    document.elementFromPoint = originalElementFromPoint;
  });

  it('触摸移动时应该选中新元素', () => {
    const elements = document.querySelectorAll('[data-selectable-id]');
    let callCount = 0;
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockImplementation(() => {
      return elements[callCount++ % 3];
    });

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const touchStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchMoveEvent = {
      touches: [{ clientX: 200, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchStart(touchStartEvent);
      result.current.containerProps.onTouchMove(touchMoveEvent);
    });

    expect(mockOnSelect).toHaveBeenCalledTimes(2);
    document.elementFromPoint = originalElementFromPoint;
  });

  it('触摸结束应该重置状态', () => {
    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    act(() => {
      result.current.containerProps.onTouchEnd();
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('鼠标按下时应该选中元素', () => {
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockReturnValue(
      document.querySelector('[data-selectable-id="1"]')
    );

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const mouseEvent = {
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.containerProps.onMouseDown(mouseEvent);
    });

    expect(mockOnSelect).toHaveBeenCalledWith(1, true);
    document.elementFromPoint = originalElementFromPoint;
  });

  it('鼠标移动时应该选中新元素', () => {
    const elements = document.querySelectorAll('[data-selectable-id]');
    let callCount = 0;
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockImplementation(() => {
      return elements[callCount++ % 3];
    });

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const mouseDownEvent = {
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    const mouseMoveEvent = {
      clientX: 200,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.containerProps.onMouseDown(mouseDownEvent);
      result.current.containerProps.onMouseMove(mouseMoveEvent);
    });

    expect(mockOnSelect).toHaveBeenCalledTimes(2);
    document.elementFromPoint = originalElementFromPoint;
  });

  it('鼠标释放应该重置状态', () => {
    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    act(() => {
      result.current.containerProps.onMouseUp();
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('鼠标离开应该重置状态', () => {
    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    act(() => {
      result.current.containerProps.onMouseLeave();
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('找不到元素时不应该调用 onSelect', () => {
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockReturnValue(null);

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const touchEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchStart(touchEvent);
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
    document.elementFromPoint = originalElementFromPoint;
  });

  it('未开始滑动时移动不应该触发选择', () => {
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockReturnValue(
      document.querySelector('[data-selectable-id="1"]')
    );

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const touchMoveEvent = {
      touches: [{ clientX: 200, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchMove(touchMoveEvent);
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
    document.elementFromPoint = originalElementFromPoint;
  });

  it('同一元素不应该重复选择', () => {
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = jest.fn().mockReturnValue(
      document.querySelector('[data-selectable-id="1"]')
    );

    const { result } = renderHook(() => useSwipeSelect({ onSelect: mockOnSelect, enabled: true }));

    const touchStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchMoveEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.containerProps.onTouchStart(touchStartEvent);
      result.current.containerProps.onTouchMove(touchMoveEvent);
      result.current.containerProps.onTouchMove(touchMoveEvent);
    });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    document.elementFromPoint = originalElementFromPoint;
  });
});
