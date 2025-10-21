import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const PortfolioContact = () => {
    const [form, setForm] = useState({ name: '', email: '', message: '' });





    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Portfolio Contact from ${form.name}`);
        // window.location.href = `mailto:youremail@example.com?subject=${subject}&body=${body}`;

        try {
            const response = await axios.post('https://programmerikram.com/wp-json/connect/v1/send-mail', {
                name: form.name,
                email: form.email,
                message: form.message,
                subject: `New message from ${form.name} On Connect Portfolio`,
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                toast.success('✅ Email sent successfully! Thank you for reaching out.', {
                    position: 'top-right',
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                });
                // Reset form after successful submission
                setForm({ name: '', email: '', message: '' });
            }
        } catch (err) {
            console.error('Error sending mail:', err.response?.data || err.message);
            toast.error('❌ Failed to send email. Please try again or contact directly via email.', {
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });
        }
    };

    return (
        <section id='contact' className='portfolio-section'>
            <h2 className='section-title'>Contact</h2>
            <p className='section-subtitle'>Let&apos;s collaborate. I&apos;m available for interesting projects.</p>
            
            <div className='about-grid mb-4'>
                <div className='about-card'>
                    <h3 className='color-wh'>Contact Information</h3>
                    <p className='color-tc'><strong>Email:</strong> mdikram295@gmail.com</p>
                    <p className='color-tc'><strong>Mobile:</strong> 01581400711</p>
                    <p className='color-tc'><strong>Website:</strong> <a href='https://programmerikram.com/portfolio' target='_blank' rel='noreferrer' className='color-pc'>programmerikram.com</a></p>
                </div>
                <div className='about-card'>
                    <h3 className='color-wh'>Address</h3>
                    <p className='color-tc'>Biler Kani, West Dewvoge</p>
                    <p className='color-tc'>Munshiganj, Bangladesh</p>
                </div>
            </div>

            <form className='contact-form' onSubmit={handleSubmit}>
                <div className='form-row'>
                    <div className='form-field'>
                        <label htmlFor='name'>Name</label>
                        <input id='name' name='name' type='text' value={form.name} onChange={handleChange} required />
                    </div>
                    <div className='form-field'>
                        <label htmlFor='email'>Email</label>
                        <input id='email' name='email' type='email' value={form.email} onChange={handleChange} required />
                    </div>
                </div>
                <div className='form-field'>
                    <label htmlFor='message'>Message</label>
                    <textarea id='message' name='message' rows={5} value={form.message} onChange={handleChange} required />
                </div>
                <button type='submit' className='btn btn-primary'>Send Email</button>
            </form>

            <div className='contact-links mt-3'>
                <a className='btn btn-outline' href='https://linkedin.com' target='_blank' rel='noreferrer'>LinkedIn</a>
                <a className='btn btn-outline' href='https://github.com' target='_blank' rel='noreferrer'>GitHub</a>
            </div>
        </section>
    );
}

export default PortfolioContact;
