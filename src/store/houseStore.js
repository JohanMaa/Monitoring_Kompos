import { create } from 'zustand';
import useSettingsStore from './settingsStore';
import useHistoryStore from './historyStore';

const useHouseStore = create((set, get) => ({
  houses: (() => {
    const savedHouses = localStorage.getItem('houses');
    return savedHouses
      ? JSON.parse(savedHouses)
      : [
          {
            id: 'rmh01',
            name: 'Rumah 1',
            compostStatus: 'Normal',
            trashStatus: 'Perlu Diperiksa',
            compostData: { suhu: 38.2, volume: 87 },
            trashData: { volume: 65 },
          },
          {
            id: 'rmh02',
            name: 'Rumah 2',
            compostStatus: 'Penuh',
            trashStatus: 'Normal',
            compostData: { suhu: 38.2, volume: 87 },
            trashData: { volume: 65 },
          },
        ];
  })(),
  addHouse: (name) => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return { error: 'Nama rumah tidak boleh kosong' };
    }
    if (trimmedName.length > 50) {
      return { error: 'Nama rumah maksimal 50 karakter' };
    }
    const houses = get().houses;
    if (houses.some((house) => house.name.toLowerCase() === trimmedName.toLowerCase())) {
      return { error: 'Nama rumah sudah digunakan' };
    }
    return set((state) => {
      const newHouse = {
        id: `rmh${(state.houses.length + 1).toString().padStart(2, '0')}`,
        name: trimmedName,
        compostStatus: 'Normal',
        trashStatus: 'Normal',
        compostData: { suhu: 0, volume: 0 },
        trashData: { volume: 0 },
      };
      const newHouses = [...state.houses, newHouse];
      localStorage.setItem('houses', JSON.stringify(newHouses));
      return { houses: newHouses };
    });
  },
  editHouse: (id, name) => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return { error: 'Nama rumah tidak boleh kosong' };
10
    }
    if (trimmedName.length > 50) {
      return { error: 'Nama rumah maksimal 50 karakter' };
    }
    const houses = get().houses;
    if (houses.some((house) => house.name.toLowerCase() === trimmedName.toLowerCase() && house.id !== id)) {
      return { error: 'Nama rumah sudah digunakan' };
    }
    return set((state) => {
      const newHouses = state.houses.map((house) =>
        house.id === id ? { ...house, name: trimmedName } : house
      );
      localStorage.setItem('houses', JSON.stringify(newHouses));
      return { houses: newHouses };
    });
  },
  deleteHouse: (id) =>
    set((state) => {
      const newHouses = state.houses.filter((house) => house.id !== id);
      localStorage.setItem('houses', JSON.stringify(newHouses));
      return { houses: newHouses };
    }),
  syncWithMqtt: (client, topic) => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error('Gagal subscribe ke topik MQTT:', err);
        return;
      }
      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          const [_, type] = topic.split('/');
          const rumahId = data.rumahId;

          if (!rumahId) {
            console.error('Data tidak valid: rumahId tidak ditemukan', data);
            return;
          }

          const house = get().houses.find((house) => house.id === rumahId);
          if (!house) {
            console.error(`Rumah dengan ID ${rumahId} tidak ditemukan`);
            return;
          }

          // Validasi data MQTT
          if (type === 'kompos') {
            if (
              !data.hasOwnProperty('suhu') ||
              !data.hasOwnProperty('volume') ||
              isNaN(data.suhu) ||
              isNaN(data.volume) ||
              data.suhu < 0 ||
              data.suhu > 100 ||
              data.volume < 0 ||
              data.volume > 100
            ) {
              console.error(
                `Data kompos tidak valid untuk ${rumahId}:`,
                data,
                'Suhu dan volume harus angka antara 0-100'
              );
              return;
            }
          } else if (type === 'sampah') {
            if (!data.hasOwnProperty('volume') || isNaN(data.volume) || data.volume < 0 || data.volume > 100) {
              console.error(`Data sampah tidak valid untuk ${rumahId}:`, data, 'Volume harus angka antara 0-100');
              return;
            }
          } else {
            console.error(`Topik MQTT tidak valid: ${topic}`);
            return;
          }

          const { thresholds } = useSettingsStore.getState();

          // Hitung status berdasarkan ambang batas
          const updateStatus = (data, thresholds) => {
            if (type === 'kompos') {
              return {
                compostStatus:
                  data.suhu > thresholds.compostTemp || data.volume > thresholds.compostVolume
                    ? 'Penuh'
                    : data.volume > thresholds.compostVolume * 0.8
                    ? 'Perlu Diperiksa'
                    : 'Normal',
              };
            } else if (type === 'sampah') {
              return {
                trashStatus:
                  data.volume > thresholds.trashVolume
                    ? 'Penuh'
                    : data.volume > thresholds.trashVolume * 0.8
                    ? 'Perlu Diperiksa'
                    : 'Normal',
              };
            }
            return {};
          };

          // Tambahkan entri riwayat jika data valid
          useHistoryStore.getState().addHistoryEntry({
            houseId: rumahId,
            houseName: house.name,
            type: type === 'kompos' ? 'Kompos' : 'Sampah',
            suhu: type === 'kompos' ? data.suhu : undefined,
            volume: data.volume,
            status: type === 'kompos' ? updateStatus(data, thresholds).compostStatus : updateStatus(data, thresholds).trashStatus,
          });

          set((state) => {
            const newHouses = state.houses.map((house) =>
              house.id === rumahId
                ? {
                    ...house,
                    ...(type === 'kompos' && {
                      compostData: { suhu: data.suhu, volume: data.volume },
                    }),
                    ...(type === 'sampah' && {
                      trashData: { volume: data.volume },
                    }),
                    ...updateStatus(data, thresholds),
                  }
                : house
            );
            localStorage.setItem('houses', JSON.stringify(newHouses));
            return { houses: newHouses };
          });
        } catch (error) {
          console.error('Gagal memproses pesan MQTT:', error);
        }
      });
    });
  },
}));

export default useHouseStore;