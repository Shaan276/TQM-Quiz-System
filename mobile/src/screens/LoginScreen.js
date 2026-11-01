import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('student1@qubix.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
  };

  const setPreset = (presetEmail) => {
    setEmail(presetEmail);
    setPassword('Password123!');
    setError('');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Brand Header */}
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>Q</Text>
          </View>
          <Text style={styles.brandTitle}>QUBIX</Text>
          <Text style={styles.brandSubtitle}>ASSESSMENT MOBILE OS</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Sign In</Text>
          <Text style={styles.formSubtitle}>Access your quizzes, live games, and coursework.</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. student1@qubix.com"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#64748B"
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Quick Presets for Demo / Testing */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsHeader}>QUICK TEST ACCOUNTS:</Text>
            <View style={styles.presetsRow}>
              <TouchableOpacity 
                style={styles.presetChip} 
                onPress={() => setPreset('student1@qubix.com')}
              >
                <Text style={styles.presetChipText}>student1</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.presetChip} 
                onPress={() => setPreset('teacher1@qubix.com')}
              >
                <Text style={styles.presetChipText}>teacher1</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.presetChip} 
                onPress={() => setPreset('admin@qubix.com')}
              >
                <Text style={styles.presetChipText}>admin</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D18'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 32
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#132238',
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  logoText: {
    color: '#34D399',
    fontSize: 32,
    fontWeight: '900'
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2
  },
  brandSubtitle: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginTop: 4
  },
  card: {
    backgroundColor: '#0E1726',
    borderRadius: 24,
    borderColor: '#1E2E48',
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold'
  },
  formSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6
  },
  input: {
    backgroundColor: '#121E36',
    borderColor: '#1F304E',
    borderWidth: 1,
    borderRadius: 14,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14
  },
  loginButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900'
  },
  presetsContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A2840'
  },
  presetsHeader: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8
  },
  presetChip: {
    backgroundColor: '#121E36',
    borderColor: '#1E2E48',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  presetChipText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  }
});
