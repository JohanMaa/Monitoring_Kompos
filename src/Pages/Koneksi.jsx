import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import mqtt from 'mqtt';
import useHouseStore from '../store/houseStore';

const Koneksi = () => {
  const navigate = useNavigate();
  const { syncWithMqtt } = useHouseStore();
  const [formData, setFormData] = useState({
    broker: 'broker.hivemq.com',
    port: '8884',
    topic: 'iot/#',
  });
  const [client, setClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Terputus');
  const [error, setError] = useState('');

  const validateInput = () => {
    const { broker, port, topic } = formData;
    if (!broker.trim()) return 'Broker tidak boleh kosong';
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return 'Port harus angka antara 1-65535';
    if (!topic.trim()) return 'Topic tidak boleh kosong';
    return '';
  };

  const connectMqtt = () => {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    const { broker, port } = formData;
    const brokerUrl = `wss://${broker}:${port}/mqtt`;

    try {
      const mqttClient = mqtt.connect(brokerUrl, { connectTimeout: 5000 });

      mqttClient.on('connect', () => {
        setConnectionStatus('Terhubung');
        setError('');
        syncWithMqtt(mqttClient, formData.topic);
      });

      mqttClient.on('error', (err) => {
        setConnectionStatus('Terputus');
        setError(`Gagal terhubung: ${err.message}`);
        mqttClient.end();
      });

      mqttClient.on('close', () => setConnectionStatus('Terputus'));

      setClient(mqttClient);
    } catch (err) {
      setError(`Gagal memulai koneksi: ${err.message}`);
    }
  };

  const disconnectMqtt = () => {
    if (client) {
      client.end();
      setClient(null);
      setConnectionStatus('Terputus');
      setError('');
    }
  };

  useEffect(() => {
    return () => {
      if (client) client.end();
    };
  }, [client]);

  const inputClass = (field) =>
    `border p-3 w-full rounded-lg focus:outline-none focus:ring-2 ${
      error.includes(field) ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'
    }`;

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Koneksi MQTT</h1>
        <div className="space-y-5">
          {/* Broker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Broker</label>
            <input
              type="text"
              value={formData.broker}
              onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
              className={inputClass('Broker')}
              placeholder="Contoh: broker.hivemq.com"
            />
          </div>
          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              className={inputClass('Port')}
              placeholder="Contoh: 8884"
              min="1"
              max="65535"
            />
          </div>
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className={inputClass('Topic')}
              placeholder="Contoh: iot/#"
            />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-gray-700">Status Koneksi</span>
            <span
              className={`${
                connectionStatus === 'Terhubung' ? 'text-green-600' : 'text-red-600'
              } font-semibold`}
            >
              {connectionStatus}
            </span>
          </div>

          {/* Error message */}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex flex-col md:flex-row gap-3 mt-4">
            <button
              onClick={connectMqtt}
              disabled={connectionStatus === 'Terhubung'}
              className={`w-full px-6 py-3 rounded-lg text-white font-medium transition-all duration-300 ${
                connectionStatus === 'Terhubung'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Hubungkan
            </button>
            <button
              onClick={disconnectMqtt}
              disabled={connectionStatus === 'Terputus'}
              className={`w-full px-6 py-3 rounded-lg text-white font-medium transition-all duration-300 ${
                connectionStatus === 'Terputus'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              Putuskan
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-300 mt-3"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    </div>
  );
};

export default Koneksi;
