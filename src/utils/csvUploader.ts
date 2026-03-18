import { collection, writeBatch, doc, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const uploadWeddingHallsFromCSV = async (rawText: string) => {
  // Normalize line endings and split
  const lines = rawText.split(/\r\n|\r|\n/);
  const halls = [];
  
  console.log(`Raw text length: ${rawText.length}`);
  console.log(`Total lines detected: ${lines.length}`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip header if it looks like one
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('예식장명') || lowerLine.includes('행정구역') || 
        lowerLine.includes('hall name') || lowerLine.includes('province')) continue;
    
    // Detect delimiter for this line specifically to be more robust
    let delimiter = ',';
    if (line.includes('\t')) {
      delimiter = '\t';
    } else if (line.includes(';')) {
      delimiter = ';';
    }
    
    const isTabLine = delimiter === '\t';
    const parts = line.split(delimiter);
    
    let name = '';
    let province = '';
    let city = '';
    let address = '';

    if (isTabLine) {
      // Excel format: Name \t Province \t City (\t Address)
      name = parts[0]?.trim();
      province = parts[1]?.trim();
      city = parts[2]?.trim();
      address = parts[3]?.trim() || '';
    } else {
      // CSV format: ,Name,Province,City,Address
      // Check if it starts with a comma (parts[0] is empty)
      if (parts[0] === '' && parts.length > 1) {
        name = parts[1]?.trim();
        province = parts[2]?.trim();
        city = parts[3]?.trim();
        address = parts[4]?.trim() || '';
      } else {
        // Standard CSV: Name,Province,City,Address
        name = parts[0]?.trim();
        province = parts[1]?.trim();
        city = parts[2]?.trim();
        address = parts[3]?.trim() || '';
      }
    }
    
    if (name && province && city) {
      halls.push({ name, province, city, address });
    } else {
      console.warn(`Skipping line ${i}: Missing required fields`, { name, province, city, line });
    }
  }
  
  console.log(`Parsed halls: ${halls.length}`);
  
  if (halls.length === 0) {
    throw new Error(`데이터를 파싱하지 못했습니다. (총 ${lines.length}줄 확인됨). 형식이 '이름 [탭/쉼표/세미콜론] 도 [탭/쉼표/세미콜론] 시' 인지 확인해주세요.`);
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  // Firestore batch limit is 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < halls.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = halls.slice(i, i + BATCH_SIZE);
    
    chunk.forEach((hall) => {
      const newDocRef = doc(collection(db, 'weddingHalls'));
      batch.set(newDocRef, hall);
    });
    
    try {
      await batch.commit();
      successCount += chunk.length;
      console.log(`Batch committed: ${successCount}/${halls.length}`);
    } catch (error) {
      console.error('Batch commit error:', error);
      errorCount += chunk.length;
    }
  }
  
  return { successCount, errorCount };
};

export const clearWeddingHalls = async () => {
  const snapshot = await getDocs(collection(db, 'weddingHalls'));
  const BATCH_SIZE = 500;
  const docs = snapshot.docs;
  
  let deletedCount = 0;
  
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);
    
    chunk.forEach((d) => {
      batch.delete(d.ref);
    });
    
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`Deleted ${deletedCount}/${docs.length} halls...`);
  }
  
  return deletedCount;
};
