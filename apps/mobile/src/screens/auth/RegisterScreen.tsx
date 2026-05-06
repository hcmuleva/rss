import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors } from '@/constants/colors';
import { useRegister } from '@/hooks/useAuth';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

export const RegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const registerMutation = useRegister();
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', password: '' }
  });

  const onSubmit = async (values: FormValues) => {
    await registerMutation.mutateAsync(values);
  };

  return (
    <View style={styles.container} accessibilityLabel="register screen">
      <Text style={styles.title}>{t('auth.register')}</Text>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            style={styles.input}
            placeholder={t('auth.name')}
            accessibilityLabel="name input"
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            keyboardType="phone-pad"
            onChangeText={onChange}
            style={styles.input}
            placeholder={t('auth.phone')}
            accessibilityLabel="phone input"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            secureTextEntry
            onChangeText={onChange}
            style={styles.input}
            placeholder={t('auth.password')}
            accessibilityLabel="password input"
          />
        )}
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)} accessibilityLabel="register button">
        <Text style={styles.buttonText}>{t('auth.register')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Login')} accessibilityLabel="login link button">
        <Text style={styles.linkText}>{t('auth.loginCta')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.background
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 10
  },
  button: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    padding: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700'
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center'
  },
  linkText: {
    color: Colors.secondary,
    fontWeight: '600'
  }
});
