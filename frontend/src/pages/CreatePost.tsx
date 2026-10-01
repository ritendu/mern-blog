import { useNavigate } from 'react-router-dom';
import { postApi } from '../api/post.api';
import PostForm from '../components/PostForm';

export default function CreatePost() {
  const navigate = useNavigate();
  return (
    <PostForm
      heading="Create post"
      submitLabel="Publish"
      savingLabel="Publishing..."
      onSubmit={async (input) => {
        const post = await postApi.create(input);
        navigate(`/posts/${post.slug}`);
      }}
    />
  );
}
