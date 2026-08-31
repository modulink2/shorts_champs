import App from './App';
import AuthForm from './AuthForm';
import { useAuth } from './AuthContext';
import { isFirebaseConfigured } from './firebase';

export default function Root() {
  const { user, loading } = useAuth();

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen w-full bg-[#060608] text-[#F5F1E8] flex items-center justify-center px-6">
        <div className="card max-w-[440px] p-6">
          <div className="label-caps text-[#D4AF37]">설정 필요</div>
          <div className="mt-2 font-[800] text-[18px]">Firebase 연결이 안 되어 있어요</div>
          <p className="mt-3 text-[13px] font-[500] leading-[1.7] text-[#9A9A93]">
            프로젝트 루트의 <code className="text-[#D4AF37]">.env.example</code> 파일을 <code className="text-[#D4AF37]">.env</code>로 복사하고,
            Firebase 콘솔에서 발급받은 웹 앱 설정 값을 채운 뒤 dev 서버를 다시 시작해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#060608] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full gold-gradient animate-pulse shadow-[0_0_24px_rgba(212,175,55,0.4)]" />
      </div>
    );
  }

  return user ? <App /> : <AuthForm />;
}
