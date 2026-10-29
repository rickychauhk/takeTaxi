import type { ModalProps } from 'react-native';

/** iOS Modal 預設只支援直屏；所有 Modal 需加上以支援橫屏 */
export const MODAL_SUPPORTED_ORIENTATIONS: NonNullable<
  ModalProps['supportedOrientations']
> = ['portrait', 'landscape'];
