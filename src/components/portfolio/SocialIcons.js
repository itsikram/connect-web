import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';

export default function SocialIcons() {
  return (
    <div className="flex space-x-4">
      <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
        <FaFacebook size={30} />
      </a>
      <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
        <FaTwitter size={30} />
      </a>
      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
        <FaInstagram size={30} />
      </a>
      <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
        <FaLinkedin size={30} />
      </a>
    </div>
  );
}
