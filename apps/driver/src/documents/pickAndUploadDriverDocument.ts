import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  type DriverDocumentType,
  uploadDriverDocument,
} from '../api/driverRegister';

export const DRIVER_DOCUMENT_LABELS: Record<DriverDocumentType, string> = {
  driving_license: '行車證',
  driver_id: '司機證',
  vehicle_registration: '車輛登記文件',
};

export async function pickAndUploadDriverDocument(
  driverId: string,
  docType: DriverDocumentType,
): Promise<boolean> {
  const label = DRIVER_DOCUMENT_LABELS[docType];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('需要權限', `請允許存取相簿以上傳${label}。`);
    return false;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]?.uri) return false;
  await uploadDriverDocument(driverId, docType, result.assets[0].uri);
  Alert.alert('已提交', `${label}已上傳，CRM 審批時可查看。`);
  return true;
}
